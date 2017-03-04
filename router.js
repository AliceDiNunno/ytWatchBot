/**
 * Created by anton on 02.03.17.
 */
const debug = require('debug')('app:router');
const querystring = require('querystring');

const messageTypes = [
    'text', 'audio', 'document', 'photo', 'sticker', 'video', 'voice', 'contact',
    'location', 'new_chat_participant', 'left_chat_participant', 'new_chat_title',
    'new_chat_photo', 'delete_chat_photo', 'group_chat_created'
];

var Router = function (bot) {
    this.stack = [];
    bot.on('message', this.handle.bind(this, 'message'));
    bot.on('callback_query', this.handle.bind(this, 'callback_query'));
};

var getMessage = function (req) {
    var message = null;
    if (req.message) {
        message = req.message;
    } else
    if (req.callback_query) {
        message = req.callback_query.message;
    }
    return message;
};

var getChatId = function () {
    return getMessage(this).chat.id;
};

var getMessageId = function () {
    return getMessage(this).message_id;
};

var getQuery = function () {
    var query = {};
    if (!this.callback_query) return query;

    var text = this.callback_query.data;
    var re = /\?([^\s]+)/;
    var m = re.exec(text);
    if (m) {
        query = querystring.parse(m[1]);
    }
    return query;
};

var getEntities = function () {
    var entities = {};
    if (!this.message || !this.message.entities) return entities;

    this.message.entities.forEach(function (entity) {
        var array = entities[entity.type];
        if (!array) {
            array = entities[entity.type] = [];
        }
        array.push({
            type: entity.type,
            value: message.text.substr(entity.offset, entity.length),
            url: entity.url,
            user: entity.user
        });
    });
    return entities;
};

/**
 * @typedef {{}} Req
 * @property {string} event
 * @property {Object} [message]
 * @property {Object} [callback_query]
 * @property {Object} [query]
 * @property {[]} params
 * @property {function():number} getChatId
 * @property {function():number} getMessageId
 * @property {function():Object} getQuery
 * @property {function():Object} getEntities
 */

/**
 * @param {string} event
 * @param {Object} message
 * @return {Req}
 */
Router.prototype.getRequest = function (event, message) {
    var req = {};
    req.getChatId = getChatId;
    req.getMessageId = getMessageId;
    req.getQuery = getQuery;
    req[event] = message;
    req.getEntities = getEntities;
    return req;
};

/**
 * @param {String} event
 * @param {Object} message
 * @return {String[]|null}
 */
var getCommands = function (event, message) {
    var commands = [];
    if (event === 'message' && message.text) {
        var text = message.text;
        var entities = message.entities.slice(0).reverse();
        var end = text.length;
        entities.forEach(function (entity) {
            if (entity.type === 'bot_command') {
                var command = text.substr(entity.offset, entity.length);
                var m = /([^@]+)/.exec(command);
                if (m) {
                    command = m[1];
                }
                var start = entity.offset + entity.length;
                var args = text.substr(start, end - start);
                if (args) {
                    command += args;
                }
                commands.unshift(command);
                end = entity.offset;
            }
        });
    } else
    if (event === 'callback_query') {
        commands = [message.data];
    }
    return commands;
};

/**
 * @param {string} event
 * @param {Object} message
 */
Router.prototype.handle = function (event, message) {
    var _this = this;
    var index = 0;
    var req = _this.getRequest(event, message);
    var command = getCommands(event, message)[0];
    var next = function () {
        var route = _this.stack[index++];
        if (!route) return;

        req.params = route.match(command);
        if (req.params) {
            if (!route.event) {
                return route.dispatch(req, next);
            } else
            if (message[route.event]) {
                if (!route.type) {
                    return route.dispatch(req, next);
                } else
                if (message[route.type]) {
                    return route.dispatch(req, next);
                }
            }
        }

        next();
    };
    next();
};

/**
 * @param {{}} details
 * @param {string} details.event
 * @param {string} details.type
 * @param {RegExp} re
 * @param {function(Object, function())} callback
 * @constructor
 */
var Route = function (details, re, callback) {
    this.re = re;
    this.event = details.event;
    this.type = details.type;
    this.dispatch = function (req, next) {
        try {
            callback(req, next);
        } catch (err) {
            debug('Dispatch error', err);
        }
    };
};

/**
 * @param {String} command
 * @return {[]|null}
 */
Route.prototype.match = function (command) {
    if (!this.re) {
        return [];
    }

    var params = this.re.exec(command);
    if (params) {
        params = params.slice(1);
    }
    return params;
};

/**
 * @param {[]} args
 * @return {{re: RegExp, callbackList: [function]}}
 */
Router.prototype.prepareArgs = function (args) {
    var re = args[0];
    var callbackList = [].slice.call(args, 1);
    if (typeof re === 'function') {
        callbackList.unshift(re);
        re = null;
    }
    return {
        re: re,
        callbackList: callbackList
    }
};

/**
 * @param {RegExp} [re]
 * @param {function(Req, function())} callback
 */
Router.prototype.all = function (re, callback) {
    var _this = this;
    var args = _this.prepareArgs(arguments);

    args.callbackList.forEach(function (callback) {
        _this.stack.push(new Route({}, args.re, callback));
    });
};

/**
 * @param {RegExp} [re]
 * @param {function(Req, function())} callback
 */
Router.prototype.message = function (re, callback) {
    var _this = this;
    var args = _this.prepareArgs(arguments);

    args.callbackList.forEach(function (callback) {
        _this.stack.push(new Route({
            event: 'message'
        }, args.re, callback));
    });
};

messageTypes.forEach(function (type) {
    /**
     * @param {RegExp} [re]
     * @param {function(Req, function())} callback
     */
    Router.prototype[type] = function (re, callback) {
        var _this = this;
        var args = _this.prepareArgs(arguments);

        args.callbackList.forEach(function (callback) {
            _this.stack.push(new Route({
                event: 'message',
                type: type
            }, args.re, callback));
        });
    };
});

/**
 * @param {RegExp} [re]
 * @param {function(Req, function())} callback
 */
Router.prototype.callback_query = function (re, callback) {
    var _this = this;
    var args = _this.prepareArgs(arguments);

    args.callbackList.forEach(function (callback) {
        _this.stack.push(new Route({
            event: 'callback_query'
        }, args.re, callback));
    });
};

module.exports = Router;