import parallel from "./tools/parallel";

const debug = require('debug')('app:Checker');
const promiseLimit = require('promise-limit');

const oneLimit = promiseLimit(1);

class Checker {
  constructor(/**Main*/main) {
    this.main = main;
  }

  init() {
    this.startUpdateInterval();
    this.startCleanInterval();
  }

  updateIntervalId = null;
  startUpdateInterval() {
    clearInterval(this.updateIntervalId);
    this.updateIntervalId = setInterval(() => {
      this.check();
    }, 5 * 60 * 1000);
  }

  cleanIntervalId = null;
  startCleanInterval() {
    clearInterval(this.cleanIntervalId);
    this.cleanIntervalId = setInterval(() => {
      this.clean();
    }, 60 * 60 * 1000);
  }

  check() {
    oneLimit(() => {
      return this.main.db.getChannelsForSync().then((channels) => {
        const channelIds = [];
        const rawChannels = [];
        channels.forEach(channel => {
          channelIds.push(channel.id);

          let publishedAfter = channel.lastSyncAt;
          if (publishedAfter === null) {
            const date = new Date();
            date.setDate(date.getDate() - 7);
            publishedAfter = date;
          }

          rawChannels.push({
            id: channel.id,
            publishedAfter: publishedAfter
          });
        });
        return this.main.db.setChannelsSyncTimeoutExpiresAt(channelIds, 5).then(() => {
          return this.main.youtube.getVideos(rawChannels);
        });
      });
    });
  }

  clean() {
    oneLimit(() => {
      this.main.db.cleanUnusedChannels();
    });
  }
}

export default Checker;