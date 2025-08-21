/**
 * By default, Architect framework try to create a public S3 bucket to store static files.
 * In our case, we don't use any static ressources avalaible publicly.
 * To ensure compliance and high security level, our AWS setup forbid public access to S3 buckets.
 * This plugin will remove the static bucket creation from the CloudFormation stack.
 * It also remove all references to the static bucket from the stack, to avoid errors.
 */

module.exports = {
	deploy: {
		start: async ({ cloudformation }) => {
			delete cloudformation.Resources.StaticBucket;
			delete cloudformation.Resources.StaticBucketPolicy;
			delete cloudformation.Resources.StaticBucketParam;

			for (const ressource of Object.values(cloudformation.Resources)) {
				const props = ressource?.Properties;
				if (props?.Environment?.Variables?.ARC_STATIC_BUCKET)
					delete ressource.Properties.Environment.Variables.ARC_STATIC_BUCKET;
				if (props?.DefinitionBody?.paths?.["/_static/{proxy+}"])
					delete ressource.Properties.DefinitionBody.paths["/_static/{proxy+}"];
				if (props?.Policies) {
					for (let i = 0; i < props.Policies.length; i++) {
						if (props.Policies[i]?.PolicyName.includes("Bucket")) {
							props.Policies.splice(i, 1);
							i--;
						}
					}
				}
			}

			delete cloudformation.Outputs.BucketURL;
			return cloudformation;
		},
	},
};
