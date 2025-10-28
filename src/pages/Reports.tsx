import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

const Reports = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">Analytics and business insights</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Reports Coming Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-muted-foreground">
              <p>• Driver end-of-day statements</p>
              <p>• Client transaction statements</p>
              <p>• Third-party delivery reports</p>
              <p>• Revenue and profit analysis</p>
              <p>• PDF export functionality</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Reports;