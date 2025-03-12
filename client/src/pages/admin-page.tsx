import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Users, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { Redirect } from "wouter";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";


export default function AdminPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [cashbackAmounts, setCashbackAmounts] = useState<Record<number, number>>({});
  const [coupons, setCoupons] = useState<Array<{ purchaseId: number; couponCode: string }>>([]);
  const [allCoupons, setAllCoupons] = useState<Array<{ purchaseId: number; couponCode: string; billNumber: string; billAmount: number; amount: number; createdAt: string }>>([]);


  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["/api/stats"],
  });

  const { data: purchases, isLoading: loadingPurchases } = useQuery({
    queryKey: ["/api/purchases"],
    select: (data) => {
      return [...data].sort((a, b) => {
        if (a.verificationStatus === b.verificationStatus) {
          return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
        }
        return a.verificationStatus === "pending" ? -1 : 1;
      });
    },
  });

  const { data: fetchedCoupons } = useQuery({
    queryKey: ["/api/purchases"],
    select: (data) => {
      return data
        .filter(p => p.verificationStatus === "verified")
        .map(p => ({
          purchaseId: p.id,
          couponCode: p.couponCode
        }))
        .filter(c => c.couponCode);
    },
  });

  const verifyPurchaseMutation = useMutation({
    mutationFn: async (purchaseId: number) => {
      const res = await apiRequest("POST", `/api/purchases/${purchaseId}/verify`, {
        cashbackAmount: cashbackAmounts[purchaseId]
      });
      const data = await res.json();

      setCoupons(prev => {
        const existing = prev.findIndex(c => c.purchaseId === purchaseId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = {purchaseId, couponCode: data.couponCode};
          return updated;
        } else {
          return [...prev, {purchaseId, couponCode: data.couponCode}];
        }
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({
        title: "Purchase verified",
        description: "Cashback coupon has been generated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (purchases) {
      const newCashbackAmounts = { ...cashbackAmounts };
      purchases.forEach((purchase) => {
        if (!newCashbackAmounts[purchase.id]) {
          newCashbackAmounts[purchase.id] = Number(purchase.billAmount) * 0.04;
        }
      });
      setCashbackAmounts(newCashbackAmounts);
    }
  }, [purchases]);

  useEffect(() => {
    if (fetchedCoupons) {
      setCoupons(fetchedCoupons);
    }
  }, [fetchedCoupons]);

  const refetchCoupons = async () => {
    const res = await apiRequest("GET", "/api/coupons");
    const data = await res.json();
    setAllCoupons(data);
  }

  useEffect(() => {
    refetchCoupons();
  }, []);


  if (!user?.isAdmin) {
    return <Redirect to="/" />;
  }

  const pendingCount = purchases?.filter(p => p.verificationStatus === "pending").length || 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <Button
            variant="ghost"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingStats ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.userCount}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Verifications</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-500">{pendingCount}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="purchases" className="mt-6">
            <TabsList className="mb-4">
              <TabsTrigger value="purchases">Customer Purchases</TabsTrigger>
              <TabsTrigger value="vouchers">Voucher Codes</TabsTrigger>
            </TabsList>

            <TabsContent value="purchases">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div>
                      Customer Purchases
                      {pendingCount > 0 && (
                        <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-800">
                          {pendingCount} pending
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingPurchases ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bill #</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchases?.map((purchase) => {
                          const user = users?.find((u) => u.id === purchase.userId);
                          const isPending =
                            purchase.verificationStatus === "pending";
                          return (
                            <TableRow key={purchase.id}>
                              <TableCell className="font-medium">
                                {purchase.billNumber}
                              </TableCell>
                              <TableCell>{user?.name}</TableCell>
                              <TableCell>₹{purchase.billAmount}</TableCell>
                              <TableCell>
                                {format(new Date(purchase.purchaseDate), "PPP")}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`px-2 py-1 text-xs rounded ${
                                    isPending
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-green-100 text-green-800"
                                  }`}
                                >
                                  {purchase.verificationStatus}
                                </span>
                              </TableCell>
                              <TableCell>
                                {isPending && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      verifyPurchaseMutation.mutate(purchase.id)
                                    }
                                    disabled={verifyPurchaseMutation.isPending}
                                    className="bg-primary hover:bg-primary/90"
                                  >
                                    {verifyPurchaseMutation.isPending && (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Verify & Generate Cashback
                                  </Button>
                                )}
                                {!isPending && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">Cashback Amount:</span>
                                      <Input
                                        type="number"
                                        value={cashbackAmounts[purchase.id] || 0}
                                        onChange={(e) => {
                                          const newAmount = Number(e.target.value);
                                          setCashbackAmounts({
                                            ...cashbackAmounts,
                                            [purchase.id]: newAmount,
                                          });
                                        }}
                                        className="w-24"
                                        step="0.01"
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => verifyPurchaseMutation.mutate(purchase.id)}
                                        disabled={verifyPurchaseMutation.isPending}
                                        className="bg-primary hover:bg-primary/90"
                                      >
                                        {verifyPurchaseMutation.isPending &&
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        }
                                        Update Cashback
                                      </Button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">Voucher Code:</span>
                                      <span className="font-mono text-primary">{
                                        coupons?.find(c => c.purchaseId === purchase.id)?.couponCode
                                      }</span>
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {!purchases?.length && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-4">
                              No purchases to verify
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="vouchers">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div>All Voucher Codes</div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => refetchCoupons()}
                      className="flex items-center gap-1"
                    >
                      <RefreshCw className="h-4 w-4" /> Refresh
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allCoupons?.map((coupon) => {
                      const purchase = purchases?.find(p => p.id === coupon.purchaseId);
                      const user = users?.find(u => u.id === purchase?.userId);

                      return (
                        <Card key={coupon.couponCode} className="border border-primary/10 bg-primary/5">
                          <CardContent className="p-4">
                            <div className="mb-2 text-center py-2 bg-primary/10 rounded">
                              <span className="block font-mono text-lg font-bold text-primary">
                                {coupon.couponCode}
                              </span>
                            </div>

                            <div className="space-y-2 mt-3">
                              <div className="flex justify-between text-sm">
                                <span className="font-medium">Bill Number:</span>
                                <span>{purchase?.billNumber}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="font-medium">Customer:</span>
                                <span>{user?.name}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="font-medium">Purchase Amount:</span>
                                <span>₹{purchase?.billAmount}</span>
                              </div>
                              <div className="flex justify-between text-sm font-semibold">
                                <span className="text-primary">Voucher Value:</span>
                                <span className="text-primary">₹{coupon.amount}</span>
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                                <span>Created:</span>
                                <span>{format(new Date(coupon.createdAt), "PPP")}</span>
                              </div>
                            </div>

                            <div className="mt-4 pt-2 border-t">
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={cashbackAmounts[coupon.purchaseId] || 0}
                                  onChange={(e) => {
                                    const newAmount = Number(e.target.value);
                                    setCashbackAmounts({
                                      ...cashbackAmounts,
                                      [coupon.purchaseId]: newAmount,
                                    });
                                  }}
                                  className="w-24"
                                  step="0.01"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => verifyPurchaseMutation.mutate(coupon.purchaseId)}
                                  disabled={verifyPurchaseMutation.isPending}
                                  className="bg-primary hover:bg-primary/90 text-xs"
                                >
                                  {verifyPurchaseMutation.isPending &&
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  }
                                  Update Value
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}

                    {!allCoupons?.length && (
                      <div className="col-span-full text-center py-8 text-muted-foreground">
                        No voucher codes generated yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>A list of all registered users.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>{user.phone}</TableCell>
                        <TableCell>{user.address}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}