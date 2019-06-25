const debug = require('debug')('app:Sender');
const promiseLimit = require('promise-limit');

const oneLimit = promiseLimit(1);

class Sender {
  constructor(/**Main*/main) {
    this.main = main;
  }

  init() {
    this.startCheckInterval();
  }

  checkIntervalId = null;
  startCheckInterval() {
    clearInterval(this.checkIntervalId);
    this.checkIntervalId = setInterval(() => {
      this.check();
    }, 5 * 60 * 1000);
  }

  check() {
    return this.main.db.getDistinctChatIdVideoIdChatIds().then((chatIds) => {
      return this.main.db.setChatSubscriptionTimeoutExpiresAt(chatIds).then(() => {
        let addedCount = 0;
        chatIds.forEach((chatId) => {
          if (!this.chatIdGenerator.has(chatId)) {
            addedCount++;
            const gen = this.getChatSenderGenerator(chatId);
            gen.chatId = chatId;
            this.chatIdGenerator.set(chatId, gen);
            this.suspendedGenerators.push(gen);
          }
        });

        this.runGenerators();

        return {addedCount: addedCount};
      });
    });
  }

  suspendedGenerators = [];
  chatIdGenerator = new Map();
  threads = [];

  runGenerators() {
    return oneLimit(() => {
      return new Promise(((resolve, reject) => {
        const {chatIdGenerator, suspendedGenerators, threads} = this;
        const threadLimit = 10;
        let canceled = false;

        return fillThreads();

        function fillThreads() {
          for (let i = 0; i < threadLimit; i++) {
            runThread();
          }
        }

        function runThread() {
          if (!suspendedGenerators.length && !threads.length || canceled) return resolve();
          if (!suspendedGenerators.length || threads.length === threadLimit) return;

          const gen = suspendedGenerators.shift();
          threads.push(gen);

          let ret = null;

          try {
            const {lastError: err, lastResult: result} = gen;
            gen.lastResult = gen.lastError = undefined;

            ret = err ? gen.throw(err) : gen.next(result);

            if (ret.done) return onFinish();

            ret.value.then((result) => {
              gen.lastResult = result;
            }, (err) => {
              gen.lastError = err;
            }).then(onFinish);
          } catch (err) {
            canceled = true;
            return reject(err);
          }

          function onFinish() {
            const pos = threads.indexOf(gen);
            if (pos !== -1) {
              threads.splice(pos, 1);
            }
            if (!ret.done) {
              suspendedGenerators.push(gen);
            } else {
              chatIdGenerator.delete(gen.chatId);
            }
            fillThreads();
          }
        }
      }));
    });
  }

  getChatSenderGenerator = function* (chatId) {
    let offset = 0;
    const getVideoIds = () => {
      const prevOffset = offset;
      offset += 10;
      return this.main.db.getVideoIdsByChatId(chatId, 10, prevOffset);
    };

    let videoIds = null;
    while (true) {
      if (!videoIds || !videoIds.length) {
        videoIds = yield getVideoIds();
      }

      if (videoIds.length) {
        const videoId = videoIds.shift();
        yield new Promise(r => setTimeout(r, 150)).then(() => {
          console.log(chatId, videoId);
        });
      }
    }
  }.bind(this);
}

export default Sender;