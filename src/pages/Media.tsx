import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import MediaGrid from "../components/media/MediaGrid";

export default function Media() {
  return (
    <div>
      <PageMeta title="Media | FusionEdge" description="Media library" />
      <PageBreadcrumb pageTitle="Media" />
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <MediaGrid />
      </div>
    </div>
  );
}
