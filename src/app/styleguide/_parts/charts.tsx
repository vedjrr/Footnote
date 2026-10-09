import type { ReactNode } from 'react';
import {
  ColumnChart,
  LineChart,
  RankedBars,
  SmallMultiples,
  Sparkline,
  Waterfall,
} from '@/ui/charts';
import { formatChange } from '@/ui/charts/format';
import {
  byCategory,
  byRegion,
  categoryChange,
  electronicsMarch,
  electronicsOnline,
  electronicsPanels,
  gbp,
  monthly,
  monthlyChange,
  revenueWalk,
} from './chart-fixtures';

function Case({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3" data-chart-case>
      <h4 className="type-caption text-ink-3">{label}</h4>
      {children}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      <h3 className="type-small font-medium text-ink-2">{title}</h3>
      <div className="grid gap-x-12 gap-y-12 wide:grid-cols-2">{children}</div>
    </div>
  );
}

const last12 = monthly.values.slice(-12);
const last12Labels = monthly.categories.slice(-12);

export function ChartsSection() {
  return (
    <div className="flex flex-col gap-16">
      <Group title="Line">
        <Case label="One series, with the point the sentence is about">
          <LineChart
            title="Revenue by month (GBP)"
            summary="Revenue by month from January 2023 to March 2025. March 2025 is 438,441 GBP, down from 476,320 GBP in February."
            categories={monthly.categories}
            series={[{ name: 'Revenue', values: monthly.values }]}
            format={gbp}
            mark={25}
          />
        </Case>
        <Case label="Four series, West emphasised">
          <LineChart
            title="Revenue by region (GBP)"
            summary="Revenue by region from April 2024 to March 2025. West falls to 101,378 GBP in March 2025 from 139,179 in February; the other regions hold level."
            categories={byRegion.categories}
            series={byRegion.series}
            format={gbp}
            emphasis="West"
          />
        </Case>
        <Case label="Four series">
          <LineChart
            title="Revenue by region (GBP)"
            summary="Revenue by region from April 2024 to March 2025; each peaks in November or December."
            categories={byRegion.categories}
            series={byRegion.series}
            format={gbp}
          />
        </Case>
        <Case label="Negative values">
          <LineChart
            title="Change in revenue on the month before (GBP)"
            summary="Change in revenue on the month before, February 2023 to March 2025. March 2025 is 37,879 GBP lower than February."
            categories={monthlyChange.categories}
            series={[{ name: 'Change', values: monthlyChange.values }]}
            format={gbp}
            zero
          />
        </Case>
        <Case label="Empty">
          <LineChart
            title="Revenue by month (GBP)"
            summary="Revenue by month."
            categories={[]}
            series={[{ name: 'Revenue', values: [] }]}
            empty="This file has no date column, so there are no months to draw."
          />
        </Case>
      </Group>

      <Group title="Columns">
        <Case label="One series, Electronics emphasised">
          <ColumnChart
            title="Revenue by category, March 2025 (GBP)"
            summary="Revenue by category in March 2025. Electronics took 98,982 GBP, second to Furniture."
            categories={byCategory.categories}
            series={[{ name: 'March 2025', values: byCategory.march }]}
            categoryName="Category"
            format={gbp}
            emphasisCategory="Electronics"
          />
        </Case>
        <Case label="Two series">
          <ColumnChart
            title="Revenue by category (GBP)"
            summary="Revenue by category in February and March 2025. Electronics fell from 139,833 to 98,982 GBP; the rest held level."
            categories={byCategory.categories}
            series={[
              { name: 'February 2025', values: byCategory.february },
              { name: 'March 2025', values: byCategory.march },
            ]}
            categoryName="Category"
            format={gbp}
          />
        </Case>
        <Case label="Ordered categories: months, labels thin out">
          <ColumnChart
            title="Revenue by month, 2024 (GBP)"
            summary="Revenue by month in 2024, highest in November and December."
            categories={monthly.categories.slice(12, 24)}
            series={[{ name: 'Revenue', values: monthly.values.slice(12, 24) }]}
            categoryName="Month"
            format={gbp}
            ordered
          />
        </Case>
        <Case label="Negative values">
          <ColumnChart
            title="Change in revenue, March on February 2025 (GBP)"
            summary="Change in revenue by category, March on February 2025. Electronics fell 40,851 GBP."
            categories={categoryChange.map((c) => c.label)}
            series={[{ name: 'Change', values: categoryChange.map((c) => c.value) }]}
            categoryName="Category"
            format={gbp}
            change
          />
        </Case>
        <Case label="Long labels: drawn as bars when the names do not fit">
          <ColumnChart
            title="Electronics revenue, March 2025 (GBP)"
            summary="Electronics revenue in March 2025 by channel and region."
            categories={electronicsMarch.slice(4, 8).map((e) => e.label)}
            series={[
              { name: 'March 2025', values: electronicsMarch.slice(4, 8).map((e) => e.value) },
            ]}
            categoryName="Channel and region"
            format={gbp}
          />
        </Case>
        <Case label="Empty">
          <ColumnChart
            title="Revenue by category (GBP)"
            summary="Revenue by category."
            categories={[]}
            series={[{ name: 'Revenue', values: [] }]}
            empty="No rows match these filters. Remove one to see values."
          />
        </Case>
      </Group>

      <Group title="Ranked bars">
        <Case label="Long labels, one emphasised">
          <RankedBars
            title="Electronics revenue by channel and region, March 2025 (GBP)"
            summary="Electronics revenue in March 2025 by channel and region. Online orders in the West took 13,480 GBP, a quarter of February's."
            items={electronicsMarch}
            categoryName="Channel and region"
            valueName="Revenue"
            format={gbp}
            emphasis="Online orders in the West"
          />
        </Case>
        <Case label="With the change labelled, Electronics emphasised">
          <RankedBars
            title="Revenue by category, March 2025 (GBP)"
            summary="Revenue by category in March 2025, with the change on February."
            items={byCategory.categories.map((label, i) => {
              const change =
                (byCategory.march[i] - byCategory.february[i]) / byCategory.february[i];
              return {
                label,
                value: byCategory.march[i],
                detail: formatChange(change, { style: 'percent' }),
              };
            })}
            categoryName="Category"
            valueName="Revenue"
            format={gbp}
            emphasis="Electronics"
          />
        </Case>
        <Case label="Negative values">
          <RankedBars
            title="Change in revenue, March on February 2025 (GBP)"
            summary="Change in revenue by category, March on February 2025. Electronics fell 40,851 GBP; Furniture rose 3,624 GBP."
            items={categoryChange}
            categoryName="Category"
            valueName="Change"
            format={gbp}
            change
          />
        </Case>
        <Case label="Empty">
          <RankedBars
            title="Revenue by category (GBP)"
            summary="Revenue by category."
            items={[]}
            empty="No rows match these filters. Remove one to see values."
          />
        </Case>
      </Group>

      <Group title="Waterfall">
        <Case label="Axis from zero">
          <Waterfall
            title="Electronics revenue online, February to March 2025 (GBP)"
            summary="Electronics revenue online fell from 93,738 to 49,484 GBP between February and March 2025; the West accounts for 43,362 GBP of the fall."
            start={electronicsOnline.start}
            steps={electronicsOnline.steps}
            end={electronicsOnline.end}
            categoryName="Region"
            format={gbp}
            emphasis="West"
          />
        </Case>
        <Case label="Small steps next to the totals: the axis zooms">
          <Waterfall
            title="Revenue, February to March 2025 (GBP)"
            summary="Revenue fell from 476,320 to 438,441 GBP between February and March 2025; Electronics accounts for 40,851 GBP of the fall."
            start={revenueWalk.start}
            steps={revenueWalk.steps}
            end={revenueWalk.end}
            categoryName="Category"
            format={gbp}
            emphasis="Electronics"
          />
        </Case>
        <Case label="Empty">
          <Waterfall
            title="Revenue, February to March 2025 (GBP)"
            summary="Revenue between February and March 2025."
            start={revenueWalk.start}
            steps={[]}
            end={revenueWalk.start}
            empty="Nothing changed between the two months."
          />
        </Case>
      </Group>

      <div className="flex flex-col gap-8">
        <h3 className="type-small font-medium text-ink-2">Small multiples</h3>
        <Case label="Lines, one panel per region, West emphasised">
          <SmallMultiples
            title="Revenue by region (GBP)"
            summary="Revenue by region from April 2024 to March 2025, on one scale. Only the West falls in March 2025."
            kind="line"
            categories={byRegion.categories}
            panels={byRegion.series}
            format={gbp}
            emphasis="West"
          />
        </Case>
        <Case label="Bars, one panel per region">
          <SmallMultiples
            title="Electronics revenue by channel, March 2025 (GBP)"
            summary="Electronics revenue in March 2025 by channel, one panel per region. Online is the largest channel in every region."
            kind="bars"
            categories={electronicsPanels.categories}
            panels={electronicsPanels.panels}
            categoryName="Channel"
            format={gbp}
          />
        </Case>
      </div>

      <div className="flex flex-col gap-8">
        <h3 className="type-small font-medium text-ink-2">Sparkline</h3>
        <Case label="Beside its figure">
          <div className="flex max-w-80 items-end gap-4">
            <div className="flex flex-col">
              <span className="type-caption text-ink-3">Revenue, March 2025</span>
              <span className="type-figure text-ink">438,441</span>
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <Sparkline
                summary="Revenue over the last 12 months, April 2024 to March 2025, ending at its lowest."
                labels={last12Labels}
                values={last12}
                format={gbp}
              />
            </div>
          </div>
        </Case>
      </div>
    </div>
  );
}
