import { Template, Match } from 'aws-cdk-lib/assertions';
import { schema } from "yaml-cfn";
import { readFileSync } from "fs";
import { load } from "js-yaml";

// https://docs.aws.amazon.com/cdk/v2/guide/testing.html <--- how to use this file

let template: Template;

describe("Infra", () => {
	beforeAll(() => {
		const yamltemplate: any = load(
			readFileSync("../deploy/template.yaml", "utf-8"),
			{ schema },
		);
		//delete yamltemplate.Resources.F2FRestApi.Properties.DefinitionBody; // To be removed, not SAM compatible.
		template = Template.fromJSON(yamltemplate);
	});

	it.skip("Should define a DefinitionBody as part of the serverless::api", () => {
		// N.B this only passes as we currently delete it on line 14 in the test setup step.
		template.hasResourceProperties("AWS::Serverless::Api", {
			DefinitionBody: Match.anyValue(),
		});
	});

	it.skip("API specification in the spec folder should match the DefinitionBody", () => {
		const api_definition: any = load(readFileSync("../deploy/spec/private-api.yaml", "utf-8"), { schema });
		template.hasResourceProperties("AWS::Serverless::Api", {
			DefinitionBody: Match.objectEquals(api_definition),
		});

	});

	it.skip("Should not define a Events section as part of the serverless::function", () => {
		// N.B this only passes as we currently delete it on line 14 in the test setup step.
		template.hasResourceProperties("AWS::Serverless::Function", {
			Events: Match.absent(),
		});
	});

	it("The template contains one API gateway resource", () => {
		template.resourceCountIs("AWS::Serverless::Api", 1);
	});

	it("Each API Gateway should have TracingEnabled", () => {
		const apiGateways = template.findResources("AWS::Serverless::Api");
		const apiGatewayList = Object.keys(apiGateways);
		apiGatewayList.forEach((apiGatewayId) => {
			expect(apiGateways[apiGatewayId].Properties.TracingEnabled).toEqual(true);
		});
	});

	it("Each API Gateway should have MethodSettings defined", () => {
		const apiGateways = template.findResources("AWS::Serverless::Api");
		const apiGatewayList = Object.keys(apiGateways);
		apiGatewayList.forEach((apiGatewayId) => {
			expect(apiGateways[apiGatewayId].Properties.MethodSettings).toBeTruthy();
		});
	});

	it("There is 4 lambda defined, all with a specific permission:", () => {
		const lambdaCount = 4;
		template.resourceCountIs("AWS::Serverless::Function", lambdaCount);
		template.resourceCountIs("AWS::Lambda::Permission", lambdaCount);
	});

	it("All lambdas must have a FunctionName defined", () => {
		const lambdas = template.findResources("AWS::Serverless::Function");
		const lambdaList = Object.keys(lambdas);
		lambdaList.forEach((lambda) => {
			expect(lambdas[lambda].Properties.FunctionName).toBeTruthy();
		});
	});

	it("All Lambdas must have an associated LogGroup named after their FunctionName.", () => {
		const lambdas = template.findResources("AWS::Serverless::Function");
		const lambdaList = Object.keys(lambdas);
		lambdaList.forEach((lambda) => {
			// These are functions we know are broken, but have to skip for now.
			// They should be resolved and removed from this list ASAP.
			const functionName = lambdas[lambda].Properties.FunctionName["Fn::Sub"];
			console.log(functionName);
			const expectedLogName = {
				"Fn::Sub": `/aws/lambda/${functionName}`,
			};
			template.hasResourceProperties("AWS::Logs::LogGroup", {
				LogGroupName: Match.objectLike(expectedLogName),
			});
		});
	});

	it("Each log group defined must have a retention period", () => {
		const logGroups = template.findResources("AWS::Logs::LogGroup");
		const logGroupList = Object.keys(logGroups);
		logGroupList.forEach((logGroup) => {
			expect(logGroups[logGroup].Properties.RetentionInDays).toBeTruthy();
		});
	});

	it("Each regional API Gateway should have at least one custom domain base path mapping name defined", () => {
		const gateways = template.findResources("AWS::Serverless::Api");
		const gatewayList = Object.keys(gateways);
		gatewayList.forEach((gateway) => {
			template.hasResourceProperties("AWS::ApiGateway::BasePathMapping", {
				RestApiId: {
					Ref: gateway,
				}
			});
		});
	});

	it("Each custom domain referenced in a BasePathMapping should be defined", () => {
		const basePathMappings = template.findResources("AWS::ApiGateway::BasePathMapping");
		const basePathMappingList = Object.keys(basePathMappings);
		basePathMappingList.forEach((basePathMapping) => {
			template.hasResourceProperties("AWS::ApiGateway::DomainName", {
				DomainName: basePathMappings[basePathMapping].Properties.DomainName
			});
		});
	});

	it("should define a DNS record for each custom domain", () => {
		const customDomainNames = template.findResources("AWS::ApiGateway::DomainName");
		const customDomainNameList = Object.keys(customDomainNames);
		customDomainNameList.forEach((customDomainName) => {
			template.hasResourceProperties("AWS::Route53::RecordSet", {
				Name: customDomainNames[customDomainName].Properties.DomainName
			});
		});
	});

	it("should define CloudWatch alarms", () => {
		const alarms = template.findResources("AWS::CloudWatch::Alarm");
		expect(Object.keys(alarms).length).toBeGreaterThan(0);
	});

	it("Each CloudWatch alarm should have an AlarmName defined", () => {
		const alarms = template.findResources("AWS::CloudWatch::Alarm");
		const alarmList = Object.keys(alarms);
		alarmList.forEach((alarmId) => {
			expect(alarms[alarmId].Properties.AlarmName).toBeTruthy();
		});
	});

	it("Each CloudWatch alarm should have Metrics defined if TreatMissingData is not 'notBreaching'", () => {
		const alarms = template.findResources("AWS::CloudWatch::Alarm");
		const alarmList = Object.keys(alarms);

		alarmList.forEach((alarmId) => {
			const properties = alarms[alarmId].Properties;
			if (properties.TreatMissingData !== "notBreaching") {
				expect(properties.Metrics).toBeTruthy();
			}
		});
	});

	it("Each CloudWatch alarm should have a ComparisonOperator defined", () => {
		const alarms = template.findResources("AWS::CloudWatch::Alarm");
		const alarmList = Object.keys(alarms);
		alarmList.forEach((alarmId) => {
			expect(alarms[alarmId].Properties.ComparisonOperator).toBeTruthy();
		});
	});

	it("Each CloudWatch alarm should have a Threshold defined", () => {
		const alarms = template.findResources("AWS::CloudWatch::Alarm");
		const alarmList = Object.keys(alarms);
		alarmList.forEach((alarmId) => {
			expect(alarms[alarmId].Properties.Threshold).toBeTruthy();
		});
	});

	it("Each CloudWatch alarm should have an EvaluationPeriods defined", () => {
		const alarms = template.findResources("AWS::CloudWatch::Alarm");
		const alarmList = Object.keys(alarms);
		alarmList.forEach((alarmId) => {
			expect(alarms[alarmId].Properties.EvaluationPeriods).toBeTruthy();
		});
	});

	it("Each CloudWatch alarm should have an AlarmActions defined", () => {
		const alarms = template.findResources("AWS::CloudWatch::Alarm");
		const alarmList = Object.keys(alarms);
		alarmList.forEach((alarmId) => {
			expect(alarms[alarmId].Properties.AlarmActions).toBeTruthy();
		});
	});

	it("Each CloudWatch alarm should have OKActions defined", () => {
		const alarms = template.findResources("AWS::CloudWatch::Alarm");
		const alarmList = Object.keys(alarms);
		alarmList.forEach((alarmId) => {
			expect(alarms[alarmId].Properties.OKActions).toBeTruthy();
		});
	});


	it("All CloudWatch alarms should have InsufficientDataActions and DatapointsToAlarm if TreatMissingData is not 'notBreaching'", () => {
		const alarms = template.findResources("AWS::CloudWatch::Alarm");
		Object.keys(alarms).forEach((alarmKey) => {
			const alarm = alarms[alarmKey];
			if (alarm.Properties.TreatMissingData !== "notBreaching") {
				expect(alarm.Properties.InsufficientDataActions).toBeDefined();
				expect(alarm.Properties.DatapointsToAlarm).toBeDefined();
			}
		});
	});

	it("PO Failure Emails warning alarm has the expected metric math", () => {
		const alarms = template.findResources("AWS::CloudWatch::Alarm");
		const entry = Object.entries(alarms).find(([logicalId]) => logicalId === "POFailureEmailsWarningAlarm");
		expect(entry).toBeDefined();

		const [, alarm] = entry!;
		const props: any = alarm.Properties;

		expect(props.TreatMissingData).toBe("notBreaching");
		expect(props.ComparisonOperator).toBe("GreaterThanOrEqualToThreshold");
		expect(props.Threshold).toBe(1);
		expect(props.EvaluationPeriods).toBe(5);
		expect(props.DatapointsToAlarm).toBe(5);

		const actionsEnabled = Boolean(props.ActionsEnabled);
		const alarmActions = props.AlarmActions ?? [];
		const okActions = props.OKActions ?? [];
		const insuff = props.InsufficientDataActions ?? [];

		const isCfnIntrinsic = (x: any) =>
		x &&
		typeof x === "object" &&
		(Object.prototype.hasOwnProperty.call(x, "Fn::ImportValue") ||
			Object.prototype.hasOwnProperty.call(x, "Fn::If") ||
			Object.prototype.hasOwnProperty.call(x, "Fn::Sub") ||
			Object.prototype.hasOwnProperty.call(x, "Ref"));

		if (actionsEnabled) {
		expect(alarmActions.length).toBeGreaterThan(0);
		expect(okActions.length).toBeGreaterThan(0);
		expect(alarmActions.every(isCfnIntrinsic)).toBe(true);
		expect(okActions.every(isCfnIntrinsic)).toBe(true);
		} else {
		expect(alarmActions).toEqual([]);
		expect(okActions).toEqual([]);
		}
		expect(insuff).toEqual([]);

		const metrics: any[] = props.Metrics;
		expect(Array.isArray(metrics)).toBe(true);

		const byId = (id: string) => metrics.find((m: any) => m.Id === id)!;

		const m1 = byId("m1");
		const m2 = byId("m2");
		const r  = byId("r");
		const x  = byId("x");

		expect(m1.MetricStat.Metric.Namespace).toBe("IPR-CRI");
		expect(m1.MetricStat.Metric.MetricName).toBe("EmailsSentTotal");
		expect(m1.MetricStat.Period).toBe(3600);
		expect(m1.MetricStat.Stat).toBe("Sum");

		expect(m2.MetricStat.Metric.Namespace).toBe("IPR-CRI");
		expect(m2.MetricStat.Metric.MetricName).toBe("EmailsPOFailure");
		expect(m2.MetricStat.Period).toBe(3600);
		expect(m2.MetricStat.Stat).toBe("Sum");

		const normalize = (s: string) => String(s).replace(/\s+/g, "");
		expect(normalize(r.Expression)).toBe("IF(m1>0,m2/m1,0)");
		expect(normalize(x.Expression)).toBe("IF(m1>=5,IF(r>=0.999,1,0),0)");
		expect(x.ReturnData).toBe(true);
	});

	//TO Be enabled once API g/w is added
	// it("should define an output with the API Gateway ID", () => {
	// 	template.hasOutput("F2FApiGatewayId", {
	// 		Value: {
	// 			"Fn::Sub": "${F2FRestApi}",
	// 		},
	// 	});
	// });

	//TO Be enabled once API g/w is added
	// it("should define an output with the F2F Backend URL using the custom domain name", () => {
	// 	template.hasOutput("F2FBackendURL", {
	// 		Value: {
	// 			"Fn::Sub": [
	// 				"https://api-${AWS::StackName}.${DNSSUFFIX}/",
	// 				{
	// 					DNSSUFFIX: {
	// 						"Fn::FindInMap": [
	// 							"EnvironmentVariables",
	// 							{
	// 								Ref: "Environment",
	// 							},
	// 							"DNSSUFFIX"
	// 						],
	// 					},
	// 				},
	// 			],
	// 		},
	// 	});
	// });

	describe("Log group retention", () => {
		it.each`
    environment      | retention
    ${"dev"}         | ${3}
    ${"build"}       | ${3}
    ${"staging"}     | ${3}
    ${"integration"} | ${30}
    ${"production"}  | ${30}
  `(
			"Log group retention period for $environment has correct value in mappings",
			({ environment, retention }) => {
				const mappings = template.findMappings("EnvironmentConfiguration");
				expect(
					mappings.EnvironmentConfiguration[environment].logretentionindays,
				).toBe(retention);
			},
		);
	});
});
