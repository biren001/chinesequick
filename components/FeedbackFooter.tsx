import Link from "next/link";
import FeedbackLink from "@/components/FeedbackLink";
import InstallApp from "@/components/InstallApp";
import { BUILD_SHA, buildDateLabel } from "@/lib/build";

/** 全站页脚。反馈入口没配置就不占任何空间。 */
export default function FeedbackFooter() {
  return (
    <footer className="mx-auto max-w-md px-5 pt-4 pb-10 text-center">
      <FeedbackLink />
      <p className="mt-4 text-xs text-muted">
        <Link className="underline-offset-4 hover:underline" href="/scenarios">
          Situations
        </Link>
        <span aria-hidden="true"> · </span>
        <Link className="underline-offset-4 hover:underline" href="/china-travel-checklist">
          Trip checklist
        </Link>
        <span aria-hidden="true"> · </span>
        <Link className="underline-offset-4 hover:underline" href="/about">
          About
        </Link>
        <span aria-hidden="true"> · </span>
        <Link className="underline-offset-4 hover:underline" href="/saved">
          Saved phrases
        </Link>
        <span aria-hidden="true"> · </span>
        <Link className="underline-offset-4 hover:underline" href="/contact">
          Contact
        </Link>
        <span aria-hidden="true"> · </span>
        <Link className="underline-offset-4 hover:underline" href="/privacy">
          Privacy
        </Link>
        <span aria-hidden="true"> · </span>
        <Link className="underline-offset-4 hover:underline" href="/terms">
          Terms
        </Link>
      </p>
      <p className="mt-2 text-xs text-muted">
        ChineseQuick · get by in China
      </p>
      {/* 装到手机上（离线用就是靠它）。不支持/已安装的平台自动不显示。 */}
      <InstallApp />
      {/* 版本号：任何页面滚到底都能确认「看到的这份是哪一次构建」，不用查源码、不用跑脚本。 */}
      <p className="mt-1 text-[11px] text-muted">
        {`build ${BUILD_SHA}${buildDateLabel() ? ` · ${buildDateLabel()}` : ""}`}
      </p>
    </footer>
  );
}
