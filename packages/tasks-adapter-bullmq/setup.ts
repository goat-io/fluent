import { cleanGlobalData, writeGlobalData } from "./src/test/const";
import { getRedisContainer } from "./src/test/redis";

export default async () => {
	const redisContainer = await getRedisContainer().start();

	writeGlobalData({
		host: redisContainer.getHost(),
		port: redisContainer.getMappedPort(6379),
	});

	return async () => {
		await redisContainer.stop();
		cleanGlobalData();
	};
};
