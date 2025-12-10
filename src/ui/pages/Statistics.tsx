import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  CpuChipIcon,
  DocumentChartBarIcon,
  ExclamationTriangleIcon,
  ServerIcon,
  SignalIcon
} from "@heroicons/react/24/outline";
import { ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";

import ConnectedHeader from "@/ui/components/ConnectedHeader";
import ConnectionList from "@/ui/components/ConnectionList";
import { useConnections, useDarkMode } from "@/ui/hooks";

export function Dashboard() {
  const { darkMode } = useDarkMode();
  const { t } = useTranslation();

  const { serverData, handleLoadServerData } = useConnections();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    interval = setInterval(() => {
      handleLoadServerData(false);
    }, 5000);
    return () => {
      clearInterval(interval);
    };
  }, [handleLoadServerData]);

  if (!serverData) return null;

  const uptimeDays = Math.floor(+serverData.serverInfo.uptime / 86400);

  return (
    <>
      <ConnectedHeader />
      <div
        className={`overflow-hidden flex-1 flex flex-col transition-all ${
          darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
        }`}
      >
        <div
          className={`w-full overflow-y-auto px-6 max-w-7xl mx-auto mt-10 transition-all ${darkMode ? "text-gray-100" : "text-gray-900"}`}
        >
          <h2 className="text-2xl font-semibold mb-6">
            {t("statistics.title")}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <InfoCard
              title={t("statistics.host")}
              value={`${serverData.host}:${serverData.port}`}
              icon={<ServerIcon className="w-10 h-10 text-blue-400" />}
            />
            <InfoCard
              title={t("statistics.uptimeLabel")}
              value={t("statistics.uptime", { count: uptimeDays })}
              icon={<ClockIcon className="w-10 h-10 text-green-400" />}
            />
            <InfoCard
              title={t("statistics.connections")}
              value={`${serverData.serverInfo.curr_connections} / ${serverData.serverInfo.max_connections}`}
              icon={<ChartBarIcon className="w-10 h-10 text-yellow-400" />}
            />
          </div>

          <h3 className="text-xl font-semibold mt-6 mb-4">
            {t("statistics.advanced")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <InfoCard
              title={t("statistics.version")}
              value={serverData.serverInfo.version}
              icon={<CpuChipIcon className="w-10 h-10 text-purple-400" />}
            />
            <InfoCard
              title={t("statistics.cacheEfficiency")}
              value={`${((+serverData.serverInfo.get_hits / (+serverData.serverInfo.get_hits + +serverData.serverInfo.get_misses)) * 100).toFixed(2)}%`}
              icon={<CheckCircleIcon className="w-10 h-10 text-teal-400" />}
            />
            <InfoCard
              title={t("statistics.commands")}
              value={`${serverData.serverInfo.cmd_get + serverData.serverInfo.cmd_set}`}
              icon={
                <DocumentChartBarIcon className="w-10 h-10 text-orange-400" />
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <InfoCard
              title={t("statistics.getSet")}
              value={`${serverData.serverInfo.cmd_get} GET / ${serverData.serverInfo.cmd_set} SET`}
              icon={
                <DocumentChartBarIcon className="w-10 h-10 text-indigo-400" />
              }
            />
            <InfoCard
              title={t("statistics.memoryUsed")}
              value={`${(+serverData.serverInfo.bytes / 1024).toFixed(2)} KB`}
              icon={<ArrowUpTrayIcon className="w-10 h-10 text-red-400" />}
            />
            <InfoCard
              title={t("statistics.requestsPerSecond")}
              value={(
                (+serverData.serverInfo.cmd_get +
                  +serverData.serverInfo.cmd_get) /
                +serverData.serverInfo.uptime
              ).toFixed(2)}
              icon={<SignalIcon className="w-10 h-10 text-teal-400" />}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <InfoCard
              title={t("statistics.bytesWritten")}
              value={serverData.serverInfo.bytes_written}
              icon={<ArrowUpTrayIcon className="w-10 h-10 text-indigo-400" />}
            />
            <InfoCard
              title={t("statistics.bytesRead")}
              value={serverData.serverInfo.bytes_read}
              icon={<ArrowDownTrayIcon className="w-10 h-10 text-indigo-400" />}
            />
            <InfoCard
              title={t("statistics.expirationsEvictions")}
              value={`${serverData.serverInfo.expired_unfetched} / ${serverData.serverInfo.evictions}`}
              icon={
                <ExclamationTriangleIcon className="w-10 h-10 text-red-400" />
              }
            />
          </div>

          <h3 className="text-xl font-semibold mt-6 mb-4">
            {t("statistics.slabs")}
          </h3>
          <div
            className={`overflow-hidden rounded-lg shadow-md mt-4 mb-10 ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}
          >
            <table className="w-full text-sm text-left">
              <thead
                className={`text-xs uppercase ${darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700"}`}
              >
                <tr>
                  <th className="px-4 py-3">{t("statistics.table.id")}</th>
                  <th className="px-4 py-3">{t("statistics.table.size")}</th>
                  <th className="px-4 py-3">{t("statistics.table.total")}</th>
                  <th className="px-4 py-3">{t("statistics.table.used")}</th>
                  <th className="px-4 py-3">{t("statistics.table.free")}</th>
                  <th className="px-4 py-3">{t("statistics.table.hits")}</th>
                </tr>
              </thead>
              <tbody>
                {serverData.serverInfo.slabs.map((slab) => (
                  <tr
                    key={slab.id}
                    className={`border-b transition-all ${darkMode ? "border-gray-700 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-50"}`}
                  >
                    <td className="px-4 py-3">{slab.id}</td>
                    <td className="px-4 py-3">{slab.chunk_size}B</td>
                    <td className="px-4 py-3">{slab.total_chunks}</td>
                    <td className="px-4 py-3">{slab.used_chunks}</td>
                    <td className="px-4 py-3">{slab.free_chunks}</td>
                    <td className="px-4 py-3">{slab.get_hits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <ConnectionList />
    </>
  );
}

const InfoCard = ({
  title,
  value,
  icon
}: {
  title: string;
  value: string;
  icon: ReactNode;
}) => {
  const { darkMode } = useDarkMode();
  return (
    <div
      className={`p-4 rounded-lg shadow-md flex items-center gap-4 ${darkMode ? "bg-gray-800 text-gray-300" : "bg-gray-200 text-gray-700"}`}
    >
      {icon}
      <div>
        <p className="text-sm text-gray-400">{title}</p>
        <p className="text-lg font-medium">{value}</p>
      </div>
    </div>
  );
};
