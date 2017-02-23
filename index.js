/**
 * Created by Anton on 06.12.2015.
 */
"use strict";
const debug = require('debug')('app:index');
const base = require('./base');
const PushApi = require('./pushApi');
const Checker = require('./checker');
const Chat = require('./chat');
const TelegramBotApi = require('node-telegram-bot-api');
const EventEmitter = require('events');
const Daemon = require('./daemon');
const Tracker = require('./tracker');
const MsgStack = require('./msgStack');
const MsgSender = require('./msgSender');
const Users = require('./users');
const Db = require('./db');

var options = {
    config: {},
    language: {},
    serviceList: ['youtube'],
    serviceToTitle: {
        youtube: 'Youtube'
    },
    serviceMatchRe: {
        youtube: [
            /youtube\.com\/(?:#\/)?(?:user|channel)\/([0-9A-Za-z_-]+)/i,
            /youtube\.com\/([0-9A-Za-z_-]+)$/i
        ]
    },
    services: {},
    events: null,
    tracker: null,
    db: null
};

(function() {
    options.events = new EventEmitter();
    Promise.all([
        base.loadConfig().then(function(config) {
            options.config = config;

            config.botName && (config.botName = config.botName.toLowerCase());
        }),
        base.loadLanguage().then(function(language) {
            options.language = language;
        })
    ]).then(function() {
        options.db = new Db(options);
        return options.db.onReady;
    }).then(function() {
        options.users = new Users(options);
        return options.users.onReady;
    }).then(function() {
        options.msgStack = new MsgStack(options);
        return options.msgStack.onReady;
    }).then(function() {
        return Promise.all(options.serviceList.map(function(name) {
            var service = require('./services/' + name);
            service = options.services[name] = new service(options);
            return service.onReady;
        }));
    }).then(function() {
        throw new Error('working...');
        options.daemon = new Daemon(options);

        (typeof gc === 'function') && options.events.on('tickTack', function() {
            gc();
        });
    }).then(function() {
        // todo: rm after update
        TelegramBotApi.prototype.answerCallbackQuery = function (queryId, text, options) {
            var form = options || {};
            form.callback_query_id = queryId;
            return this._request('answerCallbackQuery', {form: form});
        };
        TelegramBotApi.prototype.editMessageReplyMarkup = function (chatId, options) {
            var form = options || {};
            form.chat_id = chatId;
            return this._request('editMessageReplyMarkup', {form: form});
        };
        TelegramBotApi.prototype.editMessageText = function (chatId, text, options) {
            var form = options || {};
            form.chat_id = chatId;
            form.text = text;
            return this._request('editMessageText', {form: form});
        };
        var origProcessUpdate = TelegramBotApi.prototype._processUpdate;
        TelegramBotApi.prototype._processUpdate = function (update) {
            var callbackQuery = update.callback_query;
            if (callbackQuery) {
                this.emit('callback_query', callbackQuery);
            }
            origProcessUpdate.call(this, update);
        };
        var TelegramBotPolling = require('node-telegram-bot-api/src/telegramPolling');
        var origGetUpdates = TelegramBotPolling.prototype._getUpdates;
        TelegramBotPolling.prototype._getUpdates = function () {
            return origGetUpdates.call(this).then(function (updates) {
                return base.dDblUpdates(updates);
            });
        };
        TelegramBotApi.prototype.initPolling = function () {
            if (this._polling) {
                this._polling.abort = true;
                this._polling.lastRequest.cancel('Polling restart');
            }
            this._polling = new TelegramBotPolling(this.token, this.options.polling, this.processUpdate);
        };


        /**
         * @type {{
         * sendMessage: function,
         * sendPhoto: function,
         * on: function,
         * _polling: {lastUpdate: number},
         * initPolling: function
         * }}
         */
        options.bot = new TelegramBotApi(options.config.token, {
            polling: {
                timeout: options.config.pollongTimeout || 120
            }
        });

        var quote = new base.Quote(30);

        options.botQuote = quote;
        options.bot.sendMessage = quote.wrapper(options.bot.sendMessage.bind(options.bot));

        (function () {
            var request = require('request');
            var errList = [
                /Failed to get HTTP URL content/,
                /HTTP URL specified/
            ];
            options.bot.sendPhotoUrl = function (chatId, photoUrl, options) {
                var _this = this;
                var opts = {
                    qs: options || {}
                };
                opts.qs.chat_id = chatId;
                opts.qs.photo = photoUrl;
                return this._request('sendPhoto', opts).catch(function (err) {
                    var manualUpload = errList.some(function (re) {
                        return re.test(err.message);
                    });
                    if (manualUpload) {
                        return _this.sendPhoto(chatId, request({
                            url: photoUrl,
                            forever: true
                        }), options);
                    }

                    throw err;
                });
            };
        })();
        options.bot.sendPhotoUrl = quote.wrapper(options.bot.sendPhotoUrl.bind(options.bot));

        options.bot.sendPhotoQuote = quote.wrapper(options.bot.sendPhoto.bind(options.bot));
        options.bot.sendChatAction = quote.wrapper(options.bot.sendChatAction.bind(options.bot));
        options.bot.editMessageText = quote.wrapper(options.bot.editMessageText.bind(options.bot));
        options.bot.editMessageReplyMarkup = quote.wrapper(options.bot.editMessageReplyMarkup.bind(options.bot));
        options.bot.answerCallbackQuery = quote.wrapper(options.bot.answerCallbackQuery.bind(options.bot));
    }).then(function() {
        options.tracker = new Tracker(options);
    }).then(function() {
        options.msgSender = new MsgSender(options);
    }).then(function() {
        options.chat = new Chat(options);
    }).then(function() {
        options.checker = new Checker(options);
        options.pushApi = new PushApi(options);

        return options.pushApi.onReady;
    }).catch(function(err) {
        debug('Loading error', err);
    });
})();