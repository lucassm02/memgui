import { XMarkIcon } from "@heroicons/react/24/solid";
import React, { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useDarkMode } from "../hooks/useDarkMode";
import { toneButton } from "../utils/buttonTone";

type Props = {
  showDisclaimer: boolean;
  hideDisclaimer?: () => void;
  children: ReactNode;
  className?: React.StyleHTMLAttributes<HTMLDivElement> | string;
};

const Disclaimer = ({
  hideDisclaimer,
  showDisclaimer,
  children,
  className
}: Props) => {
  const { t } = useTranslation();
  const { darkMode } = useDarkMode();

  if (!showDisclaimer) return null;

  const showClose = typeof hideDisclaimer === "function";

  return (
    <div
      className={`relative rounded-md border p-3 text-xs shadow-sm max-h-48 overflow-y-auto ${
        darkMode
          ? "border-amber-500/40 text-amber-200 bg-amber-500/10"
          : "border-amber-300 text-amber-700 bg-amber-50"
      } ${className}`}
    >
      {showClose && (
        <button
          onClick={hideDisclaimer}
          className={`${toneButton(
            "warning",
            darkMode,
            "icon"
          )} absolute top-2 right-2 !p-1`}
          aria-label={t("common.close")}
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      )}

      <h3
        className={`font-semibold ${
          darkMode ? "text-amber-200" : "text-amber-800"
        }`}
      >
        {t("disclaimer.title")}
      </h3>
      <p className="mt-1">{children}</p>
    </div>
  );
};

export default Disclaimer;
