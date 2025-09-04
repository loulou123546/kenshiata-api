module.exports = {
	set: {
		env({ arc, inventory }) {
			const envs = { NONE: "1" };
			const keys = [
				"LOKI_ENDPOINT",
				"LOKI_AUTH",
				"TRACES_ENDPOINT",
				"TRACES_AUTH",
				"RUNNING_ENV",
			];
			for (const key of keys) {
				if (process.env?.[key] !== undefined) {
					envs[key] = process.env[key];
				}
			}
			return envs;
		},
	},
};
