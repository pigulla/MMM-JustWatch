Module.register('MMM-JustWatch', {
    defaults: {
        locale: 'en_US',
        search: {
        }
    },

    getStyles() {
        return ['MMM-JustWatch.css'];
    },

    start() {
        Log.info('Starting module ' + this.name);

        this.items = null;

        this.sendSocketNotification('ADD', { identifier: this.identifier, config: this.config });
    },

    socketNotificationReceived(notification, payload, sender) {
        if (notification === 'DATA') {
            if (payload.identifier === this.identifier) {
                this.items = payload.data;
                this.updateDom();
            }
        } else {
            Log.warn('Unknown notification: ' + notification);
        }
    },

    getTemplate() {
        return this.config.coverFlow ? 'template.coverflow.html' : 'template.table.html';
    },

    getTemplateData() {
        return { items: this.items, config: this.config };
    }
});
