const assert = require('assert-plus');
const Axios = require('axios');
const date_fns = require('date-fns');
const Joi = require('@hapi/joi');
const JSONs = require('json-strictify');
const NodeHelper = require('node_helper');
const uniqBy = require('lodash.uniqby');

const schema = require('./config_schema');

const axios = Axios.create({
    baseURL: 'https://apis.justwatch.com/content/'
});

function multiSort(fns) {
    return function (a, b) {
        for (let i = 0; i < fns.length; i++) {
            const c = fns[i](a, b);

            if (c !== 0) {
                return c;
            }
        }

        return 0;
    };
}

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
        if (notification === 'ADD') {
            this.handleAdd(payload.config, payload.identifier);
        } else {
            console.warn(this.name + ': Unknown notification (' + notification + ')');
        }
    },

    async handleAdd(payload, identifier) {
        const result = Joi.validate(payload, schema, { convert: false });

        if (result.error) {
            const firstError = result.error.details[0];
            console.error(this.name + '/' + identifier + ': Invalid configuration (' + firstError.message + ')');
            this.sendSocketNotification('CONFIGURATION_ERROR', { identifier, message: firstError.message });
            return;
        }

        await this.executeAndReschedule(result.value, identifier);
    },

    async executeAndReschedule(config, identifier) {
        const self = this;

        try {
            const data = await this.loadData(config);
            console.debug(this.name + '/' + identifier + ': Update successful');
            this.sendSocketNotification('DATA', { identifier, data });
        } catch (error) {
            console.error(this.name + '/' + identifier + ': ' + error.message);
            this.sendSocketNotification('LOAD_ERROR', { identifier, message: error.message });
        }

        console.debug(this.name + '/' + identifier + ': Next update will run in ' + Math.ceil(config.updateInterval / 1000) + ' seconds');
        const id = setTimeout(function () {
            self.updateTimeouts.delete(id);
            self.executeAndReschedule(config, identifier);
        }, config.updateInterval);
        this.updateTimeouts.add(id);
    },

    async loadData(config) {
        const providerMap = await this.getProviderMap(config.locale);
        const newReleases = await this.getNewReleases(config.locale, config.search, new Date());

        const result = newReleases.days[0].providers
            .reduce(function (result, entry) {
                const provider = providerMap.get(entry.provider_id) || { clean_name: 'unknown', icon_url: null };
                const items = entry.items.map(function (item) {
                    return {
                        id: item.id,
                        title: config.alwaysShowOriginalTitle ? item.original_title : item.title,
                        year: item.original_release_year,
                        type: item.object_type,
                        poster: item.poster ? ('https://images.justwatch.com' + item.poster.replace('{profile}', 's166')) : null,
                        providerName: provider.clear_name,
                        providerIcon: provider.icon_url ? ('https://images.justwatch.com' + provider.icon_url.replace('{profile}', 's25')) : null
                    };
                });
                return result.concat(items);
            }, [])
            .sort(multiSort(config.sort.map(function (x) {
                return function (a, b) {
                    if (x.key === 'year') {
                        return (a.year - b.year) * (x.direction === 'asc' ? 1 : -1)
                    } else {
                        return a[x.key].localeCompare(b[x.key]) * (x.direction === 'asc' ? 1 : -1);
                    }
                };
            })));

        return uniqBy(result, item => item.id).slice(0, config.maxEntries);
    }
});
