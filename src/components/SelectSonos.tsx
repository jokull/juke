import { Listbox, Transition } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { inferProcedureOutput } from "@trpc/server";
import classNames from "classnames";
import { Fragment, useState } from "react";

import { type SonosEvent } from "../server/trpc/router/juke";
import { AppRouter } from "../server/trpc/router/_app";
import { trpc } from "../utils/trpc";

type Speaker = inferProcedureOutput<AppRouter["juke"]["sonosDevices"]>[0];

function SonosSpeaker({ speaker }: { speaker: Speaker }) {
  const [event, setEvent] = useState<SonosEvent | null>(null);
  trpc.juke.onSonosEvent.useSubscription(speaker, {
    onData: (event) => {
      console.log({ event });
      setEvent(event);
    },
  });
  return (
    <pre className="text-xs">
      {JSON.stringify({ speaker, event }, undefined, 2)}
    </pre>
  );
}

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
    <>
      {!!selected && <SonosSpeaker speaker={selected} />}
      <Listbox value={selected} onChange={setSelected}>
        {({ open }) => (
          <>
            <div className="relative mt-1">
              <Transition
                show={open}
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options className="absolute bottom-12 z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                  <Listbox.Option
                    key="empty"
                    className={({ active }) =>
                      classNames(
                        active ? "bg-purple-600 text-white" : "text-gray-900",
                        "relative cursor-default select-none whitespace-nowrap py-2 px-3"
                      )
                    }
                    value={null}
                  >
                    No Speaker
                  </Listbox.Option>
                  {options.map((sonos) => (
                    <Listbox.Option
                      key={sonos.host}
                      className={({ active }) =>
                        classNames(
                          active ? "bg-purple-600 text-white" : "text-gray-900",
                          "relative cursor-default select-none py-2 px-3"
                        )
                      }
                      value={sonos}
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={classNames(
                              selected ? "font-semibold" : "font-normal",
                              "block truncate"
                            )}
                          >
                            {sonos.name}
                          </span>
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>

              <Listbox.Button className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 sm:text-sm">
                <span className="block truncate">
                  {selected ? selected.name : "No Speaker"}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon
                    className="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </span>
              </Listbox.Button>
            </div>
          </>
        )}
      </Listbox>
    </>
  );
}
