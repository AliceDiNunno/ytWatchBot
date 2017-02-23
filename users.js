/**
 * Created by Anton on 23.02.2017.
 */
"use strict";
var debug = require('debug')('app:Users');

var Users = function (options) {
    this.gOptions = options;

    this.onReady = this.init();
};

Users.prototype.init = function () {
    var db = this.gOptions.db;
    var promise = Promise.resolve();
    promise = promise.then(function () {
        return new Promise(function (resolve, reject) {
            db.connection.query('\
            CREATE TABLE IF NOT EXISTS `chats` ( \
                `id` VARCHAR(191) CHARACTER SET utf8mb4 NOT NULL, \
                `data` TEXT CHARACTER SET utf8mb4 NOT NULL, \
            UNIQUE INDEX `id_UNIQUE` (`id` ASC)); \
        ', function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    });
    promise = promise.then(function () {
        return new Promise(function (resolve, reject) {
            db.connection.query('\
            CREATE TABLE IF NOT EXISTS `chatIdChannelId` ( \
                `chatId` VARCHAR(191) CHARACTER SET utf8mb4 NOT NULL, \
                `service` VARCHAR(191) CHARACTER SET utf8mb4 NOT NULL, \
                `channelId` VARCHAR(191) CHARACTER SET utf8mb4 NOT NULL, \
            UNIQUE INDEX `chatIdServiceChannelId_UNIQUE` (`chatId` ASC, `service` ASC, `channelId` ASC), \
            FOREIGN KEY (`chatId`) \
                    REFERENCES `chats` (`id`) \
                    ON DELETE CASCADE \
                    ON UPDATE CASCADE); \
        ', function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    });
    return promise;
};

Users.prototype.getChat = function (id) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            SELECT * FROM chats WHERE id = ? LIMIT 1; \
        ', [id], function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve(results[0]);
            }
        });
    });
};

Users.prototype.setChat = function (id, uuid, data) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        var item = {
            id: id,
            uuid: uuid,
            data: data
        };
        db.connection.query('\
            INSERT INTO chats SET ?; \
        ', item, function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve(results[0]);
            }
        });
    });
};

Users.prototype.changeChatId = function (id, newId) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            UPDATE chats SET id = ? WHERE id = ?; \
        ', [newId, id], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

Users.prototype.changeChatData = function (id, data) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            UPDATE chats SET data = ? WHERE id = ?; \
        ', [data, id], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

Users.prototype.removeChat = function (id) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            DELETE FROM chats WHERE id = ?; \
        ', [id], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

Users.prototype.setChatChannel = function (id, channelId) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            UPDATE chats SET channelId = ? WHERE id = ?; \
        ', [channelId, id], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

Users.prototype.removeChatChannel = function (channelId) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            UPDATE chats SET channelId = ? WHERE channelId = ?; \
        ', [null, channelId], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

Users.prototype.getChannels = function (chatId) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            SELECT service, channelId FROM chatIdChannelId WHERE chatId = ?; \
        ', [chatId], function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
};

Users.prototype.insertChannel = function (chatId, service, channelId) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        var item = {
            chatId: chatId,
            service: service,
            channelId: channelId
        };
        db.connection.query('\
            INSERT INTO chatIdChannelId SET ?; \
        ', item, function (err, result) {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};

Users.prototype.removeChannel = function (chatId, service, channelId) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            DELETE FROM chatIdChannelId WHERE chatId = ? AND service = ? AND channelId = ?; \
        ', [chatId, service, channelId], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

Users.prototype.getAllChatChannels = function () {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            SELECT * FROM chatIdChannelId; \
        ', function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
};

Users.prototype.getAllChannels = function () {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            SELECT DISTINCT service, channelId FROM chatIdChannelId; \
        ', function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
};

Users.prototype.getChatIdsByChannel = function (service, channelId) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            SELECT chatId FROM chatIdChannelId WHERE service = ? AND channelId = ?; \
        ', [service, channelId], function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
};

Users.prototype.getAllChatIds = function () {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            SELECT id FROM chats; \
        ', function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
};

module.exports = Users;