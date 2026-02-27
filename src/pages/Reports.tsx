import React, { useState, useRef, useEffect, useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Bar, BarChart, PolarGrid, RadialBar, RadialBarChart, Cell } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { IconDownload } from "@tabler/icons-react";
import { TrendingUp } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { fetchReportAnalytics, ReportData, fetchManaRewardAnalytics, ManaRewardAnalytics, fetchDashboardStats } from "@/services/firestore";
import PageLoading from "@/components/PageLoading";

const CustomChartTooltip = ({ active, payload, currencyFormatter, chartType }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  
  const dataPoint = payload[0];
  const formattedDate = dataPoint.payload?.fullLabel || "";
  const value = Number(dataPoint.value || 0);
  const formattedValue = chartType === "users" ? value.toLocaleString() : currencyFormatter(value);
  const seriesLabel =
    chartType === "users"
      ? "Users"
      : chartType === "donations"
        ? "Donations"
        : chartType === "rewards"
          ? "Rewards"
          : "Total Assets";
  
  return (
    <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
      <p className="text-sm font-medium">{formattedDate}</p>
      <p className="text-sm text-muted-foreground">{seriesLabel}: {formattedValue}</p>
    </div>
  );
};

const getDateFormatter = (timeRange: string) => {
  if (timeRange === "7days" || timeRange === "1month") {
    // Daily format
    return (date: Date) => new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  } else if (timeRange === "3months" || timeRange === "6months") {
    // Weekly format - show week start (compact)
    return (date: Date) => {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(date);
    };
  } else {
    // Monthly format
    return (date: Date) => new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
    }).format(date);
  }
};

const currencyFormatter = (value: number) => {
  // Use "PHP" text instead of ₱ symbol for better PDF compatibility
  return "PHP " + new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const compactCurrencyTickFormatter = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(value)}`;
};

const getDistributionPalette = (type: string) => {
  if (type === "donations") {
    return ["#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#059669", "#047857", "#065f46"];
  }
  if (type === "rewards") {
    return ["#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309", "#92400e"];
  }
  if (type === "assets") {
    return ["#ddd6fe", "#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6"];
  }
  return ["#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a"];
};

const Reports = () => {
  const [chartType, setChartType] = useState("users");
  const [timeRange, setTimeRange] = useState("3months");
  const [chartData, setChartData] = useState<ReportData[]>([]);
  const [manaRewardData, setManaRewardData] = useState<ManaRewardAnalytics | null>(null);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const reportsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [chartAnalytics, rewardAnalytics, stats] = await Promise.all([
        fetchReportAnalytics(
          chartType as "users" | "donations" | "assets" | "rewards",
          timeRange
        ),
        fetchManaRewardAnalytics(),
        fetchDashboardStats(),
      ]);
      
      // Validate and filter out any invalid dates
      const validData = chartAnalytics.filter(d => d.date instanceof Date && !isNaN(d.date.getTime()));
      
      setChartData(validData);
      setManaRewardData(rewardAnalytics);
      setDashboardStats(stats);
      setLoading(false);
    };

    loadData();
  }, [chartType, timeRange]);

  const getChartColor = () => {
    if (chartType === "users") return "#3b82f6";
    if (chartType === "donations") return "#10b981";
    if (chartType === "rewards") return "#f59e0b";
    return "#8b5cf6";
  };

  const getChartLabel = () => {
    if (chartType === "users") return "Users";
    if (chartType === "donations") return "Donations";
    if (chartType === "rewards") return "Rewards";
    return "Total Assets";
  };

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case "7days": return "Last 7 Days";
      case "1month": return "Last Month";
      case "3months": return "Last 3 Months";
      case "6months": return "Last 6 Months";
      case "1year": return "Last Year";
      default: return "Last 3 Months";
    }
  };

  const getAggregationNote = () => {
    switch (timeRange) {
      case "7days":
      case "1month":
        return "Daily data points";
      case "3months":
      case "6months":
        return "Weekly aggregation for clarity";
      case "1year":
        return "Monthly aggregation for clarity";
      default:
        return "Weekly aggregation for clarity";
    }
  };

  const getDateRangeText = () => {
    if (chartData.length === 0) return "";
    
    const startDate = chartData[0].date;
    const endDate = new Date(); // Use current date instead of last data point
    
    const formatDate = (date: Date) => {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
    };
    
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  const getChartTypeLabel = () => {
    switch (chartType) {
      case "users": return "User Registrations";
      case "donations": return "Total Donations";
      case "rewards": return "Mana Rewards Claimed";
      case "assets": return "Total Assets";
      default: return "User Registrations";
    }
  };

  const preparedChartData = useMemo(
    () =>
      chartData.map((d) => {
        const value = chartType === "users" ? (d.count || 0) : (d.amount || 0);
        return {
          date: d.date,
          xLabel: getDateFormatter(timeRange)(d.date),
          fullLabel: new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }).format(d.date),
          value,
        };
      }),
    [chartData, chartType, timeRange]
  );

  const getIncrementalValue = (index: number) => {
    const current = preparedChartData[index]?.value || 0;
    if (chartType !== "assets" && chartType !== "rewards") return current;
    const previous = index > 0 ? preparedChartData[index - 1]?.value || 0 : 0;
    return Math.max(0, current - previous);
  };

  const distributionData = useMemo(() => {
    const palette = getDistributionPalette(chartType);

    return preparedChartData
      .map((item, idx) => {
        const value = getIncrementalValue(idx);
        return {
          label: item.xLabel,
          fullLabel: item.fullLabel,
          value,
          key: `bucket${idx}`,
          fill: palette[idx % palette.length],
        };
      })
      .slice(-12);
  }, [preparedChartData, chartType, timeRange]);

  const distributionChartConfig = useMemo(() => {
    const config: ChartConfig = {
      value: { label: getChartLabel() },
    };

    distributionData.forEach((item) => {
      config[item.key] = {
        label: item.label,
        color: item.fill,
      };
    });

    return config;
  }, [distributionData, chartType]);

  const calculateSummaryStats = () => {
    if (preparedChartData.length === 0) return { total: 0, average: 0, highest: 0, lowest: 0 };
    
    const values = preparedChartData.map((d) => d.value);
    const total = (chartType === "assets" || chartType === "rewards")
      ? (values[values.length - 1] || 0)
      : values.reduce((sum, value) => sum + value, 0);
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const highest = Math.max(...values);
    const lowest = Math.min(...values);
    
    return { total, average, highest, lowest };
  };

  const chartConfig = {
    value: {
      label: getChartLabel(),
      color: getChartColor(),
    },
  } satisfies ChartConfig;

  const calculateTrend = () => {
    if (preparedChartData.length < 2) return 0;
    
    const lastValue = preparedChartData[preparedChartData.length - 1].value || 0;
    const previousValue = preparedChartData[preparedChartData.length - 2].value || 0;
    
    if (previousValue === 0) return 0;
    
    return ((lastValue - previousValue) / previousValue) * 100;
  };

  const getMobileFriendlyDateLabel = (dateValue: Date) => {
    const date = new Date(dateValue);
    if (isMobile) {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(date);
    }
    return getDateFormatter(timeRange)(date);
  };

  const mobileXAxisInterval = isMobile ? Math.max(1, Math.floor(preparedChartData.length / 4)) : 0;
  const yAxisTickFormatter = (value: number) =>
    chartType === "users" ? String(Math.round(value)) : compactCurrencyTickFormatter(value);

  const handleExportPDF = async () => {
    if (!reportsRef.current || !manaRewardData || !dashboardStats) return;

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - (margin * 2);
      const headerHeight = 24;
      const bodyTop = 34;
      const bodyBottom = pageHeight - 16;
      const dark = [15, 23, 42] as const;
      const accent = [30, 64, 175] as const;
      const lightBg = [246, 248, 252] as const;
      const mutedText = [95, 105, 125] as const;

      const metricFormat = (value: number) =>
        chartType === "users" ? value.toLocaleString() : currencyFormatter(value);

      const currentValue = preparedChartData[preparedChartData.length - 1]?.value || 0;
      const summary = calculateSummaryStats();
      const trend = calculateTrend();

      const drawHeader = (title: string, subtitle: string) => {
        pdf.setFillColor(dark[0], dark[1], dark[2]);
        pdf.rect(0, 0, pageWidth, headerHeight, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.text("KOLI ADMIN", margin, 9);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.text(title, margin, 16);
        pdf.setTextColor(200, 210, 230);
        pdf.setFontSize(8);
        pdf.text(subtitle, pageWidth - margin, 16, { align: "right" });
      };

      const drawFooter = (pageNum: number, totalPages: number) => {
        pdf.setDrawColor(228, 232, 240);
        pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
        pdf.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(`Generated ${new Date().toLocaleString("en-US")} - KOLI Analytics`, margin, pageHeight - 7);
        pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
      };

      const drawSectionTitle = (title: string, y: number) => {
        pdf.setTextColor(20, 26, 40);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.text(title, margin, y);
        pdf.setDrawColor(223, 229, 240);
        pdf.line(margin, y + 2, pageWidth - margin, y + 2);
      };

      const drawMetricCard = (x: number, y: number, w: number, h: number, label: string, value: string) => {
        pdf.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        pdf.roundedRect(x, y, w, h, 2, 2, "F");
        pdf.setDrawColor(225, 231, 241);
        pdf.roundedRect(x, y, w, h, 2, 2, "S");
        pdf.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(label, x + 3, y + 6);
        pdf.setTextColor(accent[0], accent[1], accent[2]);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.text(value, x + 3, y + 14);
      };

      // Page 1: Cover + report context
      drawHeader("Comprehensive Performance Report", getTimeRangeLabel());
      let y = bodyTop;
      pdf.setTextColor(25, 32, 48);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.text("Analytics Report", margin, y);
      y += 9;
      pdf.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text("Operational and financial overview for administrative decision-making.", margin, y);
      y += 12;

      const contextItems = [
        ["Report Date", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })],
        ["Data Range", getDateRangeText() || "N/A"],
        ["Primary Metric", getChartTypeLabel()],
        ["Time Window", getTimeRangeLabel()],
        ["Aggregation", getAggregationNote()],
      ];
      const contextW = contentWidth;
      const rowH = 8;
      pdf.setFillColor(250, 252, 255);
      pdf.roundedRect(margin, y, contextW, rowH * contextItems.length + 6, 2, 2, "F");
      pdf.setDrawColor(225, 231, 241);
      pdf.roundedRect(margin, y, contextW, rowH * contextItems.length + 6, 2, 2, "S");
      let rowY = y + 7;
      contextItems.forEach(([k, v]) => {
        pdf.setTextColor(95, 105, 125);
        pdf.setFontSize(9);
        pdf.text(`${k}:`, margin + 4, rowY);
        pdf.setTextColor(30, 40, 60);
        pdf.text(v, margin + 35, rowY);
        rowY += rowH;
      });
      y += rowH * contextItems.length + 18;

      drawSectionTitle("Executive Highlights", y);
      y += 8;
      const statW = (contentWidth - 8) / 2;
      const statH = 20;
      drawMetricCard(margin, y, statW, statH, "Total Users", dashboardStats.totalUsers.toLocaleString());
      drawMetricCard(margin + statW + 8, y, statW, statH, "Total Donations", currencyFormatter(dashboardStats.totalDonations));
      y += statH + 6;
      drawMetricCard(margin, y, statW, statH, "Total Assets", currencyFormatter(dashboardStats.totalAssets));
      drawMetricCard(margin + statW + 8, y, statW, statH, "Pending Withdrawals", String(dashboardStats.pendingWithdrawals));

      // Page 2: Selected metric + rewards intelligence
      pdf.addPage();
      drawHeader("Selected Metric Summary", getChartTypeLabel());
      y = bodyTop;
      drawSectionTitle("Metric Snapshot", y);
      y += 8;
      const boxW = (contentWidth - 12) / 3;
      drawMetricCard(margin, y, boxW, 20, "Current", metricFormat(currentValue));
      drawMetricCard(margin + boxW + 6, y, boxW, 20, "Period Total", metricFormat(summary.total));
      drawMetricCard(margin + (boxW + 6) * 2, y, boxW, 20, "Average", metricFormat(Math.round(summary.average)));
      y += 26;
      drawMetricCard(margin, y, boxW, 20, "Highest", metricFormat(summary.highest));
      drawMetricCard(margin + boxW + 6, y, boxW, 20, "Lowest", metricFormat(summary.lowest));
      drawMetricCard(
        margin + (boxW + 6) * 2,
        y,
        boxW,
        20,
        "Trend",
        `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}%`
      );
      y += 30;

      drawSectionTitle("MANA Reward Intelligence", y);
      y += 8;
      const rewardW = (contentWidth - 12) / 3;
      drawMetricCard(margin, y, rewardW, 18, "Codes Generated", manaRewardData.totalRewardsGenerated.toLocaleString());
      drawMetricCard(margin + rewardW + 6, y, rewardW, 18, "Total Claims", manaRewardData.totalRewardsClaimed.toLocaleString());
      drawMetricCard(margin + (rewardW + 6) * 2, y, rewardW, 18, "Claim Rate", `${manaRewardData.claimRate.toFixed(1)}%`);
      y += 22;
      drawMetricCard(margin, y, rewardW, 18, "Claim Amount", currencyFormatter(manaRewardData.totalClaimAmount));
      drawMetricCard(margin + rewardW + 6, y, rewardW, 18, "Active Rewards", manaRewardData.activeRewards.toLocaleString());
      drawMetricCard(margin + (rewardW + 6) * 2, y, rewardW, 18, "Expired Rewards", manaRewardData.expiredRewards.toLocaleString());
      y += 25;

      pdf.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
      pdf.setFontSize(9);
      const summaryText = `Topline: ${manaRewardData.totalRewardsClaimed.toLocaleString()} claims with an average claim of ${currencyFormatter(manaRewardData.averageClaimAmount)}.`;
      pdf.text(pdf.splitTextToSize(summaryText, contentWidth), margin, y);

      // Page 3+: Visual analytics (paginated image slices)
      pdf.addPage();
      drawHeader("Visual Analytics", `${getChartTypeLabel()} - ${getTimeRangeLabel()}`);
      const canvas = await html2canvas(reportsRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const chartTop = bodyTop;
      const chartUsableHeight = bodyBottom - chartTop;

      let remainingHeight = imgHeight;
      let offsetY = 0;
      while (remainingHeight > 0) {
        pdf.addImage(imgData, "PNG", margin, chartTop - offsetY, imgWidth, imgHeight);
        remainingHeight -= chartUsableHeight;
        offsetY += chartUsableHeight;
        if (remainingHeight > 0) {
          pdf.addPage();
          drawHeader("Visual Analytics (cont.)", `${getChartTypeLabel()} - ${getTimeRangeLabel()}`);
        }
      }

      // Final page notes
      pdf.addPage();
      drawHeader("Methodology & Notes", "Data Quality and Interpretation");
      y = bodyTop;
      drawSectionTitle("Important Notes", y);
      y += 10;
      pdf.setTextColor(70, 78, 96);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      const notes = [
        "Data is generated from real-time Firestore records at the time of export.",
        "Donations include approved/active records for financial consistency.",
        "Displayed values may vary based on selected time range aggregation.",
        "This report is intended for internal operational decision-making.",
      ];
      notes.forEach((note, idx) => {
        const lines = pdf.splitTextToSize(`${idx + 1}. ${note}`, contentWidth);
        pdf.text(lines, margin, y);
        y += lines.length * 5 + 2;
      });

      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        drawFooter(i, totalPages);
      }

      pdf.save(`KOLI-Comprehensive-Report-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  return (
    <div className="w-full max-w-full bg-background overflow-x-hidden pb-6">
      <div className="mb-3 md:mb-6 flex flex-col gap-2 md:gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Reports</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            View analytics and statistics
          </p>
          {chartData.length > 0 && (
            <>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                Data Range: {getDateRangeText()}
              </p>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                {getAggregationNote()}
              </p>
            </>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 md:gap-3 w-full md:w-auto max-w-full">
          <Button
            onClick={handleExportPDF}
            variant="outline"
            className="gap-2 w-full sm:w-auto text-sm justify-center"
            disabled={loading || chartData.length === 0}
          >
            <IconDownload className="h-4 w-4" />
            <span className="hidden sm:inline">Export Comprehensive PDF</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="1month">Last month</SelectItem>
              <SelectItem value="3months">Last 3 months</SelectItem>
              <SelectItem value="6months">Last 6 months</SelectItem>
              <SelectItem value="1year">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={chartType} onValueChange={setChartType}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select statistic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="users">User Registrations</SelectItem>
              <SelectItem value="donations">Total Donations</SelectItem>
              <SelectItem value="rewards">Mana Rewards Claimed</SelectItem>
              <SelectItem value="assets">Total Assets</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div ref={reportsRef} className="space-y-3 sm:space-y-6 pb-4">
        {loading ? (
          <PageLoading className="min-h-[300px]" />
        ) : chartData.length === 0 ? (
          <div className="flex justify-center items-center h-[300px]">
            <p className="text-muted-foreground">No data available for the selected time range</p>
          </div>
        ) : (
          <>
        <Card className="overflow-hidden">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0">
            {(() => {
              const stats = calculateSummaryStats();
              const trend = calculateTrend();
              const formatValue = (value: number) =>
                chartType === "users" ? value.toLocaleString() : currencyFormatter(value);
              const currentValue = preparedChartData[preparedChartData.length - 1]?.value || 0;
              const items = [
                { label: "Current", value: formatValue(currentValue) },
                { label: "Period Total", value: formatValue(stats.total) },
                { label: "Average", value: formatValue(Math.round(stats.average)) },
                { label: "Trend", value: `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}%` },
              ];

              return items.map((item) => (
                <div key={item.label} className="p-4 sm:p-5 bg-muted/10">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-xl sm:text-3xl font-bold mt-1">{item.value}</p>
                </div>
              ));
            })()}
          </div>
        </Card>
      
        {/* Line Chart */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg md:text-xl">Line Chart - {getChartLabel()}</CardTitle>
            <CardDescription className="text-xs md:text-sm">{getTimeRangeLabel()}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 sm:pt-2 px-1 sm:px-6">
            <ChartContainer config={chartConfig} className="h-[240px] sm:h-[300px] w-full">
                  <LineChart
                accessibilityLayer
                data={preparedChartData}
                margin={{
                  top: 10,
                  left: isMobile ? 0 : 12,
                  right: isMobile ? 14 : 28,
                  bottom: 12,
                }}              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={mobileXAxisInterval}
                  minTickGap={isMobile ? 56 : 32}
                  padding={{ left: 8, right: 8 }}
                  tick={{ fontSize: isMobile ? 9 : 12 }}
                  tickFormatter={(value) => getMobileFriendlyDateLabel(value)}
                />
                <YAxis
                  width={isMobile ? 30 : 72}
                  hide={isMobile}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  domain={[0, (maxValue: number) => Math.max(1, Math.ceil(maxValue * 1.15))]}
                  tickFormatter={yAxisTickFormatter}
                />
                <ChartTooltip
                  cursor={false}
                  content={<CustomChartTooltip currencyFormatter={currencyFormatter} chartType={chartType} />}
                />
                <Line
                  dataKey="value"
                  type="monotoneX"
                  stroke={getChartColor()}
                  strokeWidth={2}
                  dot={preparedChartData.length <= 30 ? {
                    fill: getChartColor(),
                  } : false}
                  activeDot={{
                    r: 6,
                  }}
                />
                  </LineChart>
                </ChartContainer>
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg md:text-xl">Bar Chart - {getChartLabel()}</CardTitle>
            <CardDescription className="text-xs md:text-sm">{getTimeRangeLabel()}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 sm:pt-2 px-1 sm:px-6">
            <ChartContainer config={chartConfig} className="h-[240px] sm:h-[300px] w-full">
                  <BarChart
                accessibilityLayer
                data={preparedChartData}
                margin={{
                  top: 10,
                  left: isMobile ? 0 : 12,
                  right: isMobile ? 14 : 28,
                  bottom: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={mobileXAxisInterval}
                  minTickGap={isMobile ? 56 : 32}
                  padding={{ left: 8, right: 8 }}
                  tick={{ fontSize: isMobile ? 9 : 12 }}
                  tickFormatter={(value) => getMobileFriendlyDateLabel(value)}
                />
                <YAxis
                  width={isMobile ? 30 : 72}
                  hide={isMobile}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  domain={[0, (maxValue: number) => Math.max(1, Math.ceil(maxValue * 1.15))]}
                  tickFormatter={yAxisTickFormatter}
                />
                <ChartTooltip
                  content={<CustomChartTooltip currencyFormatter={currencyFormatter} chartType={chartType} />}
                />
                <Bar dataKey="value" fill={getChartColor()} />
                  </BarChart>
                </ChartContainer>
          </CardContent>
        </Card>

        {/* Distribution Radial Chart */}
        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle className="text-base sm:text-lg md:text-xl">Distribution Chart - {getChartLabel()}</CardTitle>
            <CardDescription className="text-xs md:text-sm">{getTimeRangeLabel()}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer
              config={distributionChartConfig}
              className="mx-auto aspect-square max-h-[240px] sm:max-h-[300px]"
            >
              <RadialBarChart
                data={distributionData}
                startAngle={90}
                endAngle={-270}
                innerRadius={28}
                outerRadius={108}
                barSize={12}
              >
                <ChartTooltip
                  cursor={false}
                  content={<CustomChartTooltip currencyFormatter={currencyFormatter} chartType={chartType} />}
                />
                <PolarGrid gridType="circle" />
                <RadialBar dataKey="value" background={{ fill: "hsl(var(--muted))" }} cornerRadius={6}>
                  {distributionData.map((entry, index) => (
                    <Cell key={`dist-cell-${entry.key}-${index}`} fill={entry.fill} />
                  ))}
                </RadialBar>
              </RadialBarChart>
            </ChartContainer>
          </CardContent>
          <div className="flex flex-col gap-2 text-sm p-4 sm:p-6 pt-2 sm:pt-3">
            {calculateTrend() !== 0 && (
              <div className="flex items-center gap-2 leading-none font-medium flex-wrap">
                {calculateTrend() > 0 ? "Trending up" : "Trending down"} by {Math.abs(calculateTrend()).toFixed(1)}% <TrendingUp className="h-4 w-4" />
              </div>
            )}
            <div className="text-muted-foreground leading-none mt-2">
              {getAggregationNote()}
            </div>
          </div>
        </Card>
        </>
        )}
      </div>
    </div>
  );
};

export default Reports;
