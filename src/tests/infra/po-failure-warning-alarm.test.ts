const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

describe('PO Failure Emails Warning Alarm', () => {
  test('alarm exists with expected metric math', () => {
    const tpl = yaml.load(
      fs.readFileSync(
        path.resolve(__dirname, '../../../deploy/template.yaml'),
        'utf8'
      )
    );

    const res = tpl.Resources || {};
    const alarm = res.POFailureEmailsWarningAlarm;
    expect(alarm).toBeDefined();
    expect(alarm.Type).toBe('AWS::CloudWatch::Alarm');

    const props = alarm.Properties;
    expect(props.ActionsEnabled).toBe(false);
    expect(props.AlarmActions || []).toEqual([]);
    expect(props.OKActions || []).toEqual([]);
    expect(props.InsufficientDataActions || []).toEqual([]);
    expect(props.TreatMissingData).toBe('notBreaching');
    expect(props.ComparisonOperator).toBe('GreaterThanOrEqualToThreshold');
    expect(props.Threshold).toBe(1);
    expect(props.EvaluationPeriods).toBe(5);
    expect(props.DatapointsToAlarm).toBe(5);

    const metrics = props.Metrics;
    const getById = id => metrics.find(m => m.Id === id);
    const m1 = getById('m1');
    const m2 = getById('m2');
    const r  = getById('r');
    const x  = getById('x');

    expect(m1.MetricStat.Metric.Namespace).toBe('IPR-CRI');
    expect(m1.MetricStat.Metric.MetricName).toBe('EmailsSentTotal');
    expect(m1.MetricStat.Period).toBe(3600);

    expect(m2.MetricStat.Metric.Namespace).toBe('IPR-CRI');
    expect(m2.MetricStat.Metric.MetricName).toBe('EmailsPOFailure');
    expect(m2.MetricStat.Period).toBe(3600);

    const normalize = s => s.replace(/\s+/g, '');
    expect(normalize(r.Expression)).toBe('IF(m1>0,m2/m1,0)');
    expect(normalize(x.Expression)).toBe('IF(m1>=5,IF(r>=0.999,1,0),0)');
    expect(x.ReturnData).toBe(true);
  });
});
