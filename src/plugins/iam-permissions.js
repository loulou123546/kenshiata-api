module.exports = {
	deploy: {
		start: async ({ arc, cloudformation }) => {
			cloudformation.Resources.Role.Properties.Policies.push({
				PolicyName: "LambdaS3Policy",
				PolicyDocument: {
					Statement: [
						{
							Effect: "Allow",
							Action: [
								"s3:GetObject",
								"s3:PutObject",
								"s3:DeleteObject",
								"s3:ListBucket",
								"s3:GetObjectTagging",
								"s3:GetObjectVersionTagging",
								"s3:DeleteObjectTagging",
								"s3:PutObjectTagging",
								"s3:PutObjectVersionTagging",
							],
							Resource: [
								"arn:aws:s3:::kenshiata-data-prod",
								"arn:aws:s3:::kenshiata-data-prod/*",
							],
						},
					],
				},
			});

			cloudformation.Resources.Role.Properties.Policies.push({
				PolicyName: "LambdaCognitoPolicy",
				PolicyDocument: {
					Statement: [
						{
							Effect: "Allow",
							Action: ["cognito-idp:*"],
							Resource: "*",
						},
						{
							Effect: "Deny",
							Action: [
								"cognito-idp:DeleteUserPool",
								"cognito-idp:DeleteUserPoolClient",
								"cognito-idp:DeleteUserPoolDomain",
								"cognito-idp:UntagResource",
							],
							Resource: "*",
						},
					],
				},
			});

			return cloudformation;
		},
	},
};
