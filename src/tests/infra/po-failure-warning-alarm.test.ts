import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { load } from "js-yaml";
import { schema } from "yaml-cfn";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function dbg(label: string, v: unknown) {
  console.log(`[po-failure-warning-alarm.test] ${label}:`, JSON.stringify(v, null, 2));
}

describe("PO Failure Emails Warning Alarm", () => {
  it("alarm exists with expected metric math", () => {
    const tpl = load(
      readFileSync(
        resolve(__dirname, "../../../deploy/template.yaml"),
        "utf8",
      ),
      { schema },
    ) as any;

    const resources: any = tpl?.Resources ?? {};
    const alarm: any = resources.POFailureEmailsWarningAlarm;

    if (!alarm) {
      dbg("available resource logical IDs", Object.keys(resources));
    }

    expect(alarm).toBeDefined();
    expect(alarm.Type).toBe("AWS::CloudWatch::Alarm");

    const props: any = alarm.Properties;
    expect(props.ActionsEnabled).toBe(false);
    expect(props.AlarmActions ?? []).toEqual([]);
    expect(props.OKActions ?? []).toEqual([]);
    expect(props.InsufficientDataActions ?? []).toEqual([]);
    expect(props.TreatMissingData).toBe("notBreaching");
    expect(props.ComparisonOperator).toBe("GreaterThanOrEqualToThreshold");
    expect(props.Threshold).toBe(1);
    expect(props.EvaluationPeriods).toBe(5);
    expect(props.DatapointsToAlarm).toBe(5);

    const metrics: any[] = props.Metrics;
    const byId = (id: string) => metrics.find((m: any) => m.Id === id);

    const m1 = byId("m1");
    const m2 = byId("m2");
    const r  = byId("r");
    const x  = byId("x");

    if (!m1 || !m2 || !r || !x) dbg("Metrics", metrics);

    expect(m1.MetricStat.Metric.Namespace).toBe("IPR-CRI");
    expect(m1.MetricStat.Metric.MetricName).toBe("EmailsSentTotal");
    expect(m1.MetricStat.Period).toBe(3600);
    expect(m1.MetricStat.Stat).toBe("Sum");

    expect(m2.MetricStat.Metric.Namespace).toBe("IPR-CRI");
    expect(m2.MetricStat.Metric.MetricName).toBe("EmailsPOFailure");
    expect(m2.MetricStat.Period).toBe(3600);
    expect(m2.MetricStat.Stat).toBe("Sum");

    const normalize = (s: string) => s.replace(/\s+/g, "");
    expect(normalize(r.Expression)).toBe("IF(m1>0,m2/m1,0)");
    expect(normalize(x.Expression)).toBe("IF(m1>=5,IF(r>=0.999,1,0),0)");
    expect(x.ReturnData).toBe(true);
  });
});
