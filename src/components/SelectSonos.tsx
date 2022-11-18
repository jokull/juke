import { RadioGroup } from "@headlessui/react";
import { inferProcedureOutput } from "@trpc/server";
import classNames from "classnames";

import { AppRouter } from "../server/trpc/router/_app";

type Speaker = inferProcedureOutput<AppRouter["juke"]["sonosDevices"]>[0];

export default function SelectSonos({
  options,
  selected,
  setSelected,
}: {
  options: Speaker[];
  selected: Speaker | null;
  setSelected: (value: Speaker | null) => void;
}) {
  return (
    <RadioGroup
      value={selected}
      onChange={setSelected}
      className="flex flex-col gap-1.5 font-mono text-xs"
    >
      <RadioGroup.Option value={null} key="browser">
        {({ checked }) => (
          <button className={classNames(checked && "text-white underline")}>
            Browser
          </button>
        )}
      </RadioGroup.Option>
      {options.map((speaker) => (
        <RadioGroup.Option value={speaker} key={speaker.host}>
          {({ checked }) => (
            <button className={classNames(checked && "text-white underline")}>
              {speaker.name}
            </button>
          )}
        </RadioGroup.Option>
      ))}
    </RadioGroup>
  );
}
