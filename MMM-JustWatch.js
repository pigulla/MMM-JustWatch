Module.register('MMM-JustWatch', {
    defaults: {
        locale: 'de_DE',
        search: {
        }
    },

    start() {
        Log.info('Starting module ' + this.name);

        this.items = null;

        this.sendSocketNotification('ADD:' + this.identifier, this.config);
    },

    socketNotificationReceived(notification, payload, sender) {
        if (notification === ('DATA:' + this.identifier)) {
            this.items = payload;
            this.updateDom();
        }
    },

    getTemplate() {
        return 'template.html';
    },

    getTemplateData() {
        return { items: this.items };
    }
});
