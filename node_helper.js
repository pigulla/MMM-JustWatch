const assert = require('assert-plus');
const Axios = require('axios');
const date_fns = require('date-fns');
const Joi = require('@hapi/joi');
const JSONs = require('json-strictify');
const NodeHelper = require('node_helper');

const schema = require('./config_schema');

const axios = Axios.create({
    baseURL: 'https://apis.justwatch.com/content/'
});

module.exports = NodeHelper.create({
    start() {
        this.updateTimeouts = new Set();
        this.cancelFns = new Set();
    },

    stop() {
        this.updateTimeouts.forEach(id => clearTimeout(id));
        this.updateTimeouts.clear();

        this.cancelFns.forEach(fn => fn());
        this.cancelFns.clear();
    },

    async getProviderMap(locale) {
        assert.string(locale, 'locale');

        const self = this;
        let cancelFn, response;

        try {
            response = await axios({
                url: 'providers/locale/' + locale,
                cancelToken: new Axios.CancelToken(function (fn) {
                    self.cancelFns.add(fn);
                    cancelFn = fn;
                })
            });
        } catch (error) {
            this.cancelFns.delete(cancelFn);
            throw new Error('Loading provider list failed (' + error.message + ')');
        }

        this.cancelFns.delete(cancelFn);

        return response.data.reduce(function (map, provider) {
            return map.set(provider.id, provider);
        }, new Map());
    },

    async getNewReleases(locale, query, date) {
        assert.string(locale, 'locale');
        assert.object(query, 'query');
        assert.date(date, 'date');

        const self = this;
        let cancelFn, response;

        const delta = date_fns.differenceInCalendarDays(new Date(), date) + 1;
        const params = Object.assign(query, { page: delta });

        try {
            response = await axios({
                url: 'titles/' + locale + '/new',
                params: {
                    body: JSONs.stringify(params)
                },
                cancelToken: new Axios.CancelToken(function (fn) {
                    self.cancelFns.add(fn);
                    cancelFn = fn;
                })
            });
        } catch (error) {
            this.cancelFns.delete(cancelFn);
            throw new Error('Loading release list failed (' + error.message + ')');
        }

        this.cancelFns.delete(cancelFn);

        return response.data;
    },

    socketNotificationReceived(notification, payload) {
        if (notification.substr(0, 4) === 'ADD:') {
            const identifier = notification.substr(4);
            this.handleAdd(payload, identifier);
        } else {
            console.warn(this.name + ': Unknown notification (' + notification + ')');
        }
    },

    async handleAdd(payload, identifier) {
        const result = Joi.validate(payload, schema, { convert: false });

        if (result.error) {
            const firstError = result.error.details[0];
            console.error(this.name + ': Invalid configuration (' + firstError.message + ')');
            this.sendSocketNotification('CONFIGURATION_ERROR', firstError);
            return;
        }

        await this.executeAndReschedule(result.value);
    },

    async executeAndReschedule(config) {
        const self = this;

        try {
            const data = await this.loadData(config);
            console.debug(this.name + ': Update successful');
            this.sendSocketNotification('DATA', data);
        } catch (error) {
            console.error(this.name + ': ' + error.message);
            this.sendSocketNotification('LOAD_ERROR', error.message);
        }

        console.debug(this.name + ': Next update will run in ' + Math.ceil(config.updateInterval / 1000) + ' seconds');
        const id = setTimeout(function () {
            self.updateTimeouts.delete(id);
            self.executeAndReschedule(config);
        }, config.updateInterval);
        this.updateTimeouts.add(id);
    },

    async loadData(config) {
        const providerMap = await this.getProviderMap(config.locale);
        const newReleases = await this.getNewReleases(config.locale, config.search, new Date());

        return newReleases.days[0].providers.reduce(function (result, entry) {
            const provider = providerMap.get(entry.provider_id);
            const items = entry.items.map(function (item) {
                return {
                    title: item.title,
                    originalTitle: item.original_title,
                    type: item.object_type,
                    poster: 'https://images.justwatch.com' + item.poster.replace('{profile}', 's166'),
                    provider_name: provider.clear_name,
                    provider_icon: 'https://images.justwatch.com' + provider.icon_url.replace('{profile}', 's25'),
                };
            });
            return result.concat(items);
        }, []);
    }
});
