import Layout from '@/components/Layout';
import { ThirdPartyStatementsTab } from '@/components/thirdparty/ThirdPartyStatementsTab';
import { Truck } from 'lucide-react';

const ThirdPartyStatements = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Truck className="h-8 w-8" />
            Third Party Settlements
          </h1>
          <p className="text-muted-foreground mt-1">
            Track remittances from third-party delivery providers
          </p>
        </div>
        
        <ThirdPartyStatementsTab />
      </div>
    </Layout>
  );
};

export default ThirdPartyStatements;
