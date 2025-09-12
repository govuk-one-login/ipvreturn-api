import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { load } from "js-yaml";
import { schema } from "yaml-cfn";

function findTemplatePath(): string {
  const cwd = (globalThis as any)?.process?.cwd?.() ?? "";
  const candidates = [

    resolve(__dirname, "../../../deploy/template.yaml"),

    resolve(__dirname, "../../deploy/template.yaml"),

    resolve(cwd, "deploy/template.yaml"),
    "deploy/template.yaml",
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      `Cannot locate deploy/template.yaml. Tried:\n${candidates.join("\n")}`,
    );
  }
  return found;
}

describe("PO Failure Emails Warning Alarm", () => {
  it("alarm exists with expected metric math", () => {
    const tplPath = findTemplatePath();
    const tpl = load(readFileSync(tplPath, "utf8"), { schema }) as any;

    const resources: any = tpl?.Resources ?? {};
    const alarm: any = resources.POFailureEmailsWarningAlarm;

    expect(alarm).toBeDefined();
    expect(alarm.Type).toBe("AWS::CloudWatch::Alarm");

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
    const r = byId("r");
    const x = byId("x");

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
});
