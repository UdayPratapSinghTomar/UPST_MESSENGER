const ONLINE_USERS_SET = 'online_users_set';
const redisClient = require('../config/redis');

module.exports = {
    addUser: async (user_id, socket_id) => {
        await redisClient.set(`online_users:${user_id}`, socket_id)
        await redisClient.sAdd(ONLINE_USERS_SET, user_id)
    },

    removeUserBySocket: async (socket_id) => {
        const keys = await redisClient.keys('online_users:*');

        for(const key of keys){
            const storedSocket = await redisClient.get(key);
            if(storedSocket === socket_id){
                const user_id = key.split(':')[1]
                await redisClient.del(key)
                await redisClient.sRem(ONLINE_USERS_SET, user_id)
                await redisClient.set(`user_last_seen:${user_id}`, Date.now())
                break
            }
        }
    }, 

    getOnlineUsers: async () => {
        return await redisClient.sMembers(ONLINE_USERS_SET)
    },

    isUserOnline: async (user_id) => {
        const socket_id = await redisClient.get(`online_users:${user_id}`)
        return !!socket_id
    }
}