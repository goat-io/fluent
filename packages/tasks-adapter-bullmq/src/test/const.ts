import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type GlobalTempData = {
	host?: string;
	port?: number;
};

const tempDataFilePath = resolve(join(__dirname, "../../"), "tempData.json");

export const getGlobalData = (): GlobalTempData => {
	const data = JSON.parse(readFileSync(tempDataFilePath, "utf-8"));
	return data;
};

export const writeGlobalData = (data: GlobalTempData) => {
	writeFileSync(tempDataFilePath, JSON.stringify(data), "utf-8");
};

export const cleanGlobalData = () => {
	if (existsSync(tempDataFilePath)) {
		unlinkSync(tempDataFilePath);
	}
};
