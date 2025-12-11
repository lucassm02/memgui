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

  return (
    <div
      className={`relative p-4 rounded-lg bg-yellow-50 border border-yellow-300 text-yellow-900 text-sm shadow-md ${className}`}
    >
      <button
        onClick={hideDisclaimer}
        className={`${toneButton(
          "warning",
          darkMode,
          "icon"
        )} absolute top-2 right-2 !p-1`}
        aria-label={t("common.close")}
      >
        {typeof hideDisclaimer === "function" && (
          <XMarkIcon className="w-5 h-5" />
        )}
      </button>

      <h3 className="font-semibold text-yellow-800">{t("disclaimer.title")}</h3>
      <p className="mt-1">{children}</p>
    </div>
  );
};

export default Disclaimer;
