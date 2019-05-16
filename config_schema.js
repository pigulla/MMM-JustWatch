const Joi = require('@hapi/joi');

function null_or_array() {
    return Joi.array().items(Joi.string().only([].slice.call(arguments))).unique().allow(null).default(null);
}

module.exports = Joi.object().unknown(false).keys({
    locale: Joi.string().required().regex(/^[a-z]+_[A-Z]+$/),
    updateInterval: Joi.number().integer().positive().default(60 * 1000),
    maxEntries: Joi.number().integer().positive().default(10),
    alwaysShowOriginalTitle: Joi.boolean().default(false),
    hideProviderIcon: Joi.boolean().default(false),
    coverFlow: Joi.boolean().default(false),
    sort: Joi.array()
        .items(Joi.object().unknown(false).keys({
            key: Joi.string().only('title', 'year', 'providerName'),
            direction: Joi.string().only('asc', 'desc')
        })).default([{ key: 'title', order: 'asc' }]),
    search: Joi.object().required().unknown(false).keys({
        content_types: null_or_array('movie', 'show_season'),
        age_certifications: null_or_array('0', '6', '12', '16', '18'),
        genres: null_or_array(
            'act', // Action & Adventure
            'ani', // Animation
            'cmy', // Comedy
            'crm', // Crime
            'doc', // Documentary
            'drm', // Drama
            'fml', // Kids & Family
            'fnt', // Fantasy
            'hrr', // Horror
            'hst', // History
            'msc', // Music & Musical
            'rma', // Romance
            'scf', // Science-Fiction
            'spt', // Sport & Fitness
            'trl', // Mystery & Thriller
            'war', // War & Military
            'wsn'  // Western
        ),
        monetization_types: null_or_array(
            'flatrate', 'rent', 'buy', 'ads', 'free'
        ),
        presentation_types: null_or_array(
            'sd', 'hd', '4k'
        ),
        providers: null_or_array(
            'nfx', // Netflix
            'amp', // Amazon Prime Video
            'amz', // Amazon Video
            'sko', // Sky Ticket
            'skg', // Sky Go
            'max', // Maxdome
            'itu', // Apple iTunes
            'ply', // Google Play Movies
            'yot', // YouTube
            'ast', // Starz Play Amazon Channel
            'aan', // Animax Plus Amazon Channel
            'sks', // Sky Store
            'wki', // Rakuten TV
            'mds', // maxdome Store
            'msf', // Microsoft Store
            'pls', // PlayStation
            'rlz', // realeyz
            'vdb', // Videobuster
            'pfx', // Pantaflix
            'chi', // Chili
            'uni', // Universcine
            'kvd', // Kividoo
            'shd', // Shudder
            'etv', // EntertainTV
            'ntz', // Netzkino
            'als', // Alleskino
            'fli', // Flimmit
            'wbx', // Watchbox
            'mbi', // Mubi
            'gdc', // GuideDoc
            'nfk', // Netflix Kids
            'ytr', // YouTube Premium
            'dem', // Das Erste Mediathek
            'art'  // Arte
        ),
        release_year_from: Joi.number().integer().min(1900).allow(null).default(null),
        release_year_until: Joi.number().integer().min(1900).allow(null).default(null),
        scoring_filter_types: Joi.object().unknown(false).allow(null).default(null).keys({
            'imdb:score': Joi.object().unknown(false).keys({
                min_scoring_value: Joi.number().min(0).max(10).default(0).required(),
                max_scoring_value: Joi.number().min(0).max(10).default(0).required()
            }),
            'tomato:meter': Joi.object().unknown(false).optional().keys({
                min_scoring_value: Joi.number().min(0).max(100).default(0).required(),
                max_scoring_value: Joi.number().min(0).max(100).default(0).required()
            }).unknown(false).optional()
        })
    })
});
