import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Button } from '@/ui/button';
import { Field } from '@/ui/field';
import { Icon, iconNames } from '@/ui/icon';
import { Notice, Status } from '@/ui/notice';
import { Rule } from '@/ui/rule';
import { StaticTag, Tag } from '@/ui/tag';
import { ThemeToggle } from '@/ui/theme-toggle';
import { CopyDemo, MenuDemo, PanelDemo, TooltipDemo } from './_parts/interactive';
import { MarkDemo, MarkStates, WorkingPaperSpecimen } from './_parts/mark-demo';
import { Swatches } from './_parts/swatches';

export const metadata: Metadata = { title: 'Styleguide' };

const surfaces = [
  { token: '--paper', use: 'Page, reading column, chart surface' },
  { token: '--ledger', use: 'Working paper and evidence' },
  { token: '--wash', use: 'Table headers, inputs, hover' },
  { token: '--rule', use: 'Hairlines on paper' },
  { token: '--ledger-rule', use: 'Hairlines on ledger' },
];
const inks = [
  { token: '--ink', on: '--paper', use: 'Text, primary buttons' },
  { token: '--ink-2', on: '--paper', use: 'Secondary text' },
  { token: '--ink-3', on: '--paper', use: 'Captions, axis labels, placeholders' },
  { token: '--mark', on: '--paper', use: 'Reference marks, links, focus ring' },
  { token: '--highlight', use: 'The linked highlight, nothing else' },
  { token: '--highlight-ink', on: '--highlight', use: 'Text on the highlight' },
];
const statuses = [
  { token: '--good', on: '--paper', use: 'Passed, with icon and word' },
  { token: '--caution', on: '--paper', use: 'Caution, with icon and word' },
  { token: '--critical', on: '--paper', use: 'Problem, with icon and word' },
];
const series = [
  { token: '--series-1', use: 'Series 1, emphasis, rise' },
  { token: '--series-2', use: 'Series 2, fall' },
  { token: '--series-3', use: 'Series 3' },
  { token: '--series-4', use: 'Series 4' },
  { token: '--series-context', use: 'Context grey' },
];

const typeStyles: Array<{ name: string; spec: string; className: string; sample: string }> = [
  {
    name: 'headline',
    spec: 'Serif 400, 30 to 44 / 1.18, 30ch',
    className: 'type-headline',
    sample: 'Revenue fell 7.4% in March, mostly from Electronics sold online in the West',
  },
  {
    name: 'h2',
    spec: 'Serif 500, 24 / 32',
    className: 'type-h2',
    sample: 'Before you rely on this',
  },
  {
    name: 'lead',
    spec: 'Serif 400, 21 / 32',
    className: 'type-lead',
    sample: 'The top 20% of customers hold 61% of revenue.',
  },
  {
    name: 'prose',
    spec: 'Serif 400, 18 / 30, 17 / 28 on phones, 66ch',
    className: 'type-prose',
    sample:
      'Three quarters of the fall came from Electronics sold online in the West. Every other region held within two percent of February.',
  },
  { name: 'figure', spec: 'Sans 600, 28 / 32', className: 'type-figure', sample: '1,210,655' },
  {
    name: 'body',
    spec: 'Sans 400, 16 / 24',
    className: 'type-body',
    sample: 'Choose a metric to see how it is defined.',
  },
  {
    name: 'small',
    spec: 'Sans 400 or 500, 14 / 20',
    className: 'type-small',
    sample: 'Reading 48,210 rows',
  },
  {
    name: 'caption',
    spec: 'Sans 400, 12 / 16',
    className: 'type-caption text-ink-3',
    sample: 'Months, January 2024 to March 2025',
  },
  {
    name: 'code',
    spec: 'Mono 400, 13 / 20, SQL only',
    className: 'type-code',
    sample: 'SELECT CAST(SUM(revenue) AS DOUBLE) FROM orders',
  },
];

const spacing = [4, 8, 12, 16, 24, 32, 48, 64, 96];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6">
      <Rule kind="section" />
      <h2 id={id} className="type-h2 text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="type-small font-medium text-ink-2">{title}</h3>
      {children}
    </div>
  );
}

function State({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <span className="type-caption text-ink-3">{label}</span>
      {children}
    </div>
  );
}

export default function Styleguide() {
  return (
    <>
      <header className="flex h-14 items-center gap-6 border-b border-rule px-4 md:px-8">
        <span className="font-serif text-[18px] font-medium text-ink">
          Footnote<sup className="fn-ref">1</sup>
        </span>
        <span className="type-small text-ink-3">Styleguide</span>
        <span className="ml-auto">
          <ThemeToggle />
        </span>
      </header>

      <main className="flex flex-col gap-16 px-4 py-12 md:px-8 lg:px-[clamp(24px,8vw,128px)]">
        <div className="flex max-w-170 flex-col gap-4">
          <h1 className="type-headline text-ink">Styleguide</h1>
          <p className="type-prose text-ink-2">
            Every token and component the interface is built from, in its states. Switch the theme
            at the top right to see the dark values. Later screens use only what is on this page.
          </p>
        </div>

        <Section id="mark" title="Reference mark and highlight">
          <p className="type-body max-w-170 text-ink-2">
            Select a numbered mark with the mouse or the keyboard. The number and the matching value
            in the working paper light up together.
          </p>
          <MarkDemo />
          <Sub title="Mark states">
            <MarkStates />
          </Sub>
          <Sub title="Working paper with note 1 selected">
            <WorkingPaperSpecimen />
          </Sub>
        </Section>

        <Section id="colour" title="Colour">
          <Sub title="Surfaces and lines">
            <Swatches items={surfaces} caption="Values in the current theme." />
          </Sub>
          <Sub title="Ink, mark and highlight">
            <Swatches
              items={inks}
              caption="Contrast is worked out from the values in the current theme."
            />
          </Sub>
          <Sub title="Status">
            <Swatches
              items={statuses}
              caption="Status colour always comes with an icon and a word."
            />
          </Sub>
          <Sub title="Chart series">
            <Swatches
              items={series}
              caption="Every chart also has direct labels and a table view."
            />
          </Sub>
        </Section>

        <Section id="type" title="Type">
          <dl className="flex flex-col gap-8">
            {typeStyles.map((t) => (
              <div key={t.name} className="flex flex-col gap-2 md:flex-row md:gap-8">
                <dt className="flex shrink-0 flex-col md:w-48">
                  <span className="type-small font-medium text-ink">{t.name}</span>
                  <span className="type-caption text-ink-3">{t.spec}</span>
                </dt>
                <dd className={`${t.className} min-w-0 text-ink`}>{t.sample}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="space" title="Space, shape and depth">
          <Sub title="Spacing scale">
            <ul className="flex flex-col gap-2">
              {spacing.map((s) => (
                <li key={s} className="flex items-center gap-4">
                  <span className="w-8 type-caption text-ink-3 tabular-nums">{s}</span>
                  <span className="h-3 bg-ink-3" style={{ width: s }} />
                </li>
              ))}
            </ul>
          </Sub>
          <div className="flex flex-wrap gap-8">
            <State label="Radius 2: inputs, buttons, tags, tables">
              <span className="block h-16 w-24 rounded-sm border border-ink-3" />
            </State>
            <State label="Radius 6: Ask bar, menus, sheets">
              <span className="block h-16 w-24 rounded-md border border-ink-3" />
            </State>
            <State label="The one shadow, for floating things">
              <span className="block h-16 w-24 rounded-md border border-rule bg-paper shadow-float" />
            </State>
          </div>
          <Sub title="Rules">
            <State label="Section start, 32 px in ink">
              <Rule kind="section" />
            </State>
            <div className="flex flex-col gap-2">
              <span className="type-caption text-ink-3">Hairline on paper</span>
              <Rule />
            </div>
            <div className="flex flex-col gap-2 bg-ledger p-4">
              <span className="type-caption text-ink-3">Hairline on ledger</span>
              <Rule surface="ledger" />
            </div>
          </Sub>
          <Sub title="Motion">
            <dl className="grid grid-cols-1 gap-2 type-small sm:grid-cols-[12rem_1fr]">
              <dt className="text-ink">Highlight wipe</dt>
              <dd className="text-ink-2">180 ms, left to right</dd>
              <dt className="text-ink">Working paper change</dt>
              <dd className="text-ink-2">120 ms cross-fade</dd>
              <dt className="text-ink">Panels and sheets</dt>
              <dd className="text-ink-2">240 ms, cubic-bezier(0.2, 0, 0, 1)</dd>
              <dt className="text-ink">Hover and focus</dt>
              <dd className="text-ink-2">120 ms at most</dd>
              <dt className="text-ink">Reduced motion</dt>
              <dd className="text-ink-2">All of the above appear without movement</dd>
            </dl>
          </Sub>
        </Section>

        <Section id="icons" title="Icons">
          <p className="type-small text-ink-2">Lucide, 1.5 px stroke, at 16 and 20 px.</p>
          <ul className="flex flex-wrap gap-6">
            {iconNames.map((name) => (
              <li key={name} className="flex w-20 flex-col items-start gap-2 text-ink">
                <span className="flex gap-3">
                  <Icon name={name} size={16} />
                  <Icon name={name} size={20} />
                </span>
                <span className="type-caption text-ink-3">{name}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="buttons" title="Buttons">
          <Sub title="Primary, one per view at most">
            <div className="flex flex-wrap gap-6">
              <State label="Rest">
                <Button variant="primary">Add to report</Button>
              </State>
              <State label="Hover">
                <Button variant="primary" className="bg-ink-2">
                  Add to report
                </Button>
              </State>
              <State label="Focus">
                <Button variant="primary" className="outline-2 outline-offset-2 outline-mark">
                  Add to report
                </Button>
              </State>
              <State label="Disabled">
                <Button variant="primary" disabled>
                  Add to report
                </Button>
              </State>
            </div>
          </Sub>
          <Sub title="Secondary">
            <div className="flex flex-wrap gap-6">
              <State label="Rest">
                <Button>Show all</Button>
              </State>
              <State label="Hover">
                <Button className="bg-wash">Show all</Button>
              </State>
              <State label="Focus">
                <Button className="outline-2 outline-offset-2 outline-mark">Show all</Button>
              </State>
              <State label="Disabled">
                <Button disabled>Show all</Button>
              </State>
            </div>
          </Sub>
          <Sub title="Quiet">
            <div className="flex flex-wrap gap-6">
              <State label="Rest">
                <CopyDemo />
              </State>
              <State label="Hover">
                <Button variant="quiet" className="underline">
                  Copy SQL
                </Button>
              </State>
              <State label="Focus">
                <Button variant="quiet" className="outline-2 outline-offset-2 outline-mark">
                  Copy SQL
                </Button>
              </State>
              <State label="Disabled">
                <Button variant="quiet" disabled>
                  Copy SQL
                </Button>
              </State>
            </div>
          </Sub>
        </Section>

        <Section id="fields" title="Fields">
          <div className="grid max-w-170 grid-cols-1 gap-8 md:grid-cols-2">
            <State label="Rest, with placeholder">
              <Field label="Workspace name" placeholder="Harbour & Pine" className="w-full" />
            </State>
            <State label="Focus">
              <Field
                label="Find a column"
                defaultValue="order_date"
                className="w-full"
                inputClassName="outline-2 outline-offset-2 outline-mark"
              />
            </State>
            <State label="Filled, with help text">
              <Field
                label="Report title"
                defaultValue="March revenue review"
                hint="Shown at the top of the exported report."
                className="w-full"
              />
            </State>
            <State label="Error">
              <Field
                label="Gemini API key"
                defaultValue="abc"
                error="This key is too short. Paste the whole key from Google AI Studio and try again."
                className="w-full"
              />
            </State>
            <State label="Disabled">
              <Field
                label="Model"
                defaultValue="Flash"
                hint="Unavailable while AI assist is off."
                disabled
                className="w-full"
              />
            </State>
          </div>
        </Section>

        <Section id="tags" title="Tags and menus">
          <Sub title="Interpretation row">
            <div className="flex flex-wrap gap-2">
              <Tag label="Metric" value="Revenue" />
              <Tag label="Split by" value="Region" />
              <MenuDemo />
              <Tag label="Compared with" value="Previous period" assumed />
              <StaticTag label="Rows" value="48,210" />
            </div>
          </Sub>
          <Sub title="Menu, as it opens">
            <div className="w-64 rounded-md border border-rule bg-paper p-1 shadow-float type-small text-ink">
              <p className="px-2 py-1 type-caption text-ink-3">Period</p>
              <p className="flex min-h-8 items-center gap-2 rounded-sm bg-wash px-2">
                <span className="flex w-4">
                  <Icon name="check" />
                </span>
                March 2025
              </p>
              <p className="flex min-h-8 items-center gap-2 rounded-sm px-2">
                <span className="w-4" />
                Q1 2025
              </p>
              <hr className="my-1 border-0 border-t border-rule" />
              <p className="flex min-h-8 items-center gap-2 rounded-sm px-2">
                <span className="flex-1">Revenue</span>
                <span className="text-ink-3">metric</span>
              </p>
              <p className="flex min-h-8 items-center gap-2 rounded-sm px-2 opacity-50">
                <span className="flex-1">West</span>
                <span className="text-ink-3">value</span>
              </p>
            </div>
          </Sub>
          <Sub title="Tooltip">
            <div className="flex items-center gap-4">
              <TooltipDemo />
              <span className="rounded-sm border border-rule bg-paper px-2 py-1 type-caption text-ink shadow-float">
                Copy SQL
              </span>
            </div>
          </Sub>
        </Section>

        <Section id="status" title="Status and notices">
          <div className="flex flex-col gap-3">
            <Status tone="good">Parts add up to the total.</Status>
            <Status tone="caution">March has two days with no rows.</Status>
            <Status tone="critical">The date column has 312 values that are not dates.</Status>
          </div>
          <Notice>AI assist is off. Briefings and answers are computed in your browser.</Notice>
          <Notice tone="caution" action={<Button variant="quiet">Try again</Button>}>
            AI assist did not answer, so this answer was read without it.
          </Notice>
          <Sub title="Progress">
            <p className="type-small text-ink-2">Comparing March with February</p>
            <p className="fn-stale type-prose text-ink">
              Revenue fell 7.4% in March. This text is held at 60% while it is recomputed.
            </p>
          </Sub>
        </Section>

        <Section id="tables" title="Tables">
          <Sub title="On paper. Sized to its content; when too wide it scrolls inside its box with the first column fixed">
            <div className="fn-table-wrap">
              <table className="fn-table">
                <caption>Revenue by region, January to March 2025</caption>
                <thead>
                  <tr>
                    <th scope="col">Region</th>
                    <th scope="col" className="num">
                      January
                    </th>
                    <th scope="col" className="num">
                      February
                    </th>
                    <th scope="col" className="num">
                      March
                    </th>
                    <th scope="col" className="num">
                      Change
                    </th>
                    <th scope="col" className="num">
                      Share of March
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">West</th>
                    <td className="num">402,118</td>
                    <td className="num">411,960</td>
                    <td className="num">339,392</td>
                    <td className="num">−17.6%</td>
                    <td className="num">28.0%</td>
                  </tr>
                  <tr>
                    <th scope="row">North</th>
                    <td className="num">298,441</td>
                    <td className="num">301,207</td>
                    <td className="num">297,866</td>
                    <td className="num">−1.1%</td>
                    <td className="num">24.6%</td>
                  </tr>
                  <tr>
                    <th scope="row">South</th>
                    <td className="num">322,950</td>
                    <td className="num">318,604</td>
                    <td className="num">311,112</td>
                    <td className="num">−2.4%</td>
                    <td className="num">25.7%</td>
                  </tr>
                  <tr>
                    <th scope="row">East</th>
                    <td className="num">270,005</td>
                    <td className="num">275,641</td>
                    <td className="num">262,285</td>
                    <td className="num">−4.8%</td>
                    <td className="num">21.7%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Sub>
        </Section>

        <Section id="overlays" title="Panel and sheet">
          <p className="type-body max-w-170 text-ink-2">
            The panel slides in from the right on tablets. The sheet rises from the bottom on
            phones. Both take focus, close on Esc and give focus back to the button that opened
            them.
          </p>
          <PanelDemo />
        </Section>
      </main>
    </>
  );
}
