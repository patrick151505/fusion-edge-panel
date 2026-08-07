import CatalogueDashboard from "../../components/dashboard/CatalogueDashboard";
import PageMeta from "../../components/common/PageMeta";

export default function Home() {
  return (
    <>
      <PageMeta
        title="Dashboard | FusionEdge"
        description="Catalogue overview — products, variations, brands and more."
      />
      <CatalogueDashboard />
    </>
  );
}
