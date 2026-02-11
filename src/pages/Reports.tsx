import React, { useState, useRef, useEffect } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Bar, BarChart, Pie, PieChart, Label } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { IconDownload } from "@tabler/icons-react";
import { TrendingUp } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { fetchReportAnalytics, ReportData, fetchManaRewardAnalytics, ManaRewardAnalytics, fetchDashboardStats } from "@/services/firestore";

// Custom tooltip component for proper date formatting
const CustomChartTooltip = ({ active, payload, label, currencyFormatter, chartType }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  
  const dataPoint = payload[0];
  const timestamp = dataPoint.payload?.date;
  
  if (!timestamp) return null;
  
  try {
    const date = new Date(timestamp);
    const formattedDate = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    
    const value = dataPoint.value;
    const formattedValue = chartType === "users" 
      ? String(value)
      : currencyFormatter(value);
    
    return (
      <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
        <p className="text-sm font-medium">{formattedDate}</p>
        <p className="text-sm text-muted-foreground">{dataPoint.name}: {formattedValue}</p>
      </div>
    );
  } catch (e) {
    return null;
  }
};

const dateFormatter = (date: Date) => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
};

const getDateFormatter = (timeRange: string) => {
  if (timeRange === "7days" || timeRange === "1month") {
    // Daily format
    return (date: Date) => new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  } else if (timeRange === "3months" || timeRange === "6months") {
    // Weekly format - show week start
    return (date: Date) => {
      const weekStart = new Date(date);
      return `Week of ${new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(weekStart)}`;
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

const Reports = () => {
  const [chartType, setChartType] = useState("users");
  const [timeRange, setTimeRange] = useState("3months");
  const [chartData, setChartData] = useState<ReportData[]>([]);
  const [manaRewardData, setManaRewardData] = useState<ManaRewardAnalytics | null>(null);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const reportsRef = useRef<HTMLDivElement>(null);

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
      console.log(`📊 Reports.tsx received ${chartAnalytics.length} data points for ${chartType}`);
      console.log(`📈 First 3 data points:`, chartAnalytics.slice(0, 3));
      console.log(`📈 First 3 dates check:`, chartAnalytics.slice(0, 3).map(d => ({
        date: d.date,
        dateType: typeof d.date,
        isValidDate: d.date instanceof Date && !isNaN(d.date.getTime()),
        timestamp: d.date instanceof Date ? d.date.getTime() : 'NOT A DATE',
        value: chartType === "users" ? d.count : d.amount
      })));
      
      // Validate and filter out any invalid dates
      const validData = chartAnalytics.filter(d => d.date instanceof Date && !isNaN(d.date.getTime()));
      console.log(`✅ ${validData.length} valid data points out of ${chartAnalytics.length}`);
      
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

  if (loading || chartData.length === 0) {
    return (
      <div className="h-full bg-background p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">
            View analytics and statistics
          </p>
        </div>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">
            {loading ? "Loading report data..." : "No data available for the selected time range"}
          </p>
        </div>
      </div>
    );
  }

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

  const calculateSummaryStats = () => {
    if (chartData.length === 0) return { total: 0, average: 0, highest: 0, lowest: 0 };
    
    const values = chartData.map(d => chartType === "users" ? (d.count || 0) : (d.amount || 0));
    const total = values[values.length - 1] || 0; // Latest cumulative value
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
    if (chartData.length < 2) return 0;
    
    const lastValue = chartType === "users" 
      ? (chartData[chartData.length - 1].count || 0)
      : (chartData[chartData.length - 1].amount || 0);
    
    const firstValue = chartType === "users"
      ? (chartData[0].count || 0)
      : (chartData[0].amount || 0);
    
    if (firstValue === 0) return 0;
    
    return ((lastValue - firstValue) / firstValue) * 100;
  };

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
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      let yPosition = margin;
      let pageNumber = 1;

      // Helper function to add page header
      const addPageHeader = (pageNum: number) => {
        // Dark background like the website
        pdf.setFillColor(20, 24, 35);
        pdf.rect(0, 0, pageWidth, 35, "F");
        
        // Gold text for branding
        pdf.setTextColor(245, 184, 0);
        pdf.setFontSize(24);
        pdf.setFont("helvetica", "bold");
        pdf.text("KOLI ADMIN", margin, 15);
        
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(255, 255, 255);
        pdf.text("Comprehensive Analytics Report", margin, 24);
        
        const currentDate = new Date().toLocaleDateString("en-US", { 
          year: "numeric", 
          month: "long", 
          day: "numeric" 
        });
        pdf.setFontSize(10);
        pdf.text(currentDate, pageWidth - margin, 15, { align: "right" });
        pdf.text(getTimeRangeLabel(), pageWidth - margin, 24, { align: "right" });
        
        if (chartData.length > 0) {
          pdf.setFontSize(8);
          pdf.text(getDateRangeText(), pageWidth - margin, 30, { align: "right" });
        }
      };

      // Helper function to add page footer
      const addPageFooter = (pageNum: number, totalPages: string) => {
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.setFont("helvetica", "italic");
        pdf.text("Generated by KOLI Admin System", margin, pageHeight - 10);
        pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" });
      };

      // Helper function to check if new page is needed
      const checkNewPage = (requiredSpace: number) => {
        if (yPosition + requiredSpace > pageHeight - 20) {
          addPageFooter(pageNumber, "...");
          pdf.addPage();
          pageNumber++;
          addPageHeader(pageNumber);
          yPosition = 45;
          return true;
        }
        return false;
      };

      // Helper function to add section title
      const addSectionTitle = (title: string, colorRGB: number[] = [245, 184, 0]) => {
        checkNewPage(15);
        pdf.setFillColor(colorRGB[0], colorRGB[1], colorRGB[2]);
        pdf.rect(margin, yPosition, contentWidth, 8, "F");
        
        // Use dark text on gold background for better readability
        pdf.setTextColor(20, 24, 35);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.text(title.toUpperCase(), margin + 3, yPosition + 5.5);
        yPosition += 12;
      };

      // PAGE 1: Executive Summary
      addPageHeader(pageNumber);
      yPosition = 45;

      // Executive Summary Title
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("Executive Summary", margin, yPosition);
      yPosition += 12;

      // Key Metrics Overview
      const boxWidth = (contentWidth - 7.5) / 4;
      const boxHeight = 25;
      
      const keyMetrics = [
        { 
          label: "Total Users", 
          value: dashboardStats.totalUsers.toLocaleString(),
          color: [245, 184, 0],
          symbol: "USERS"
        },
        { 
          label: "Total Donations", 
          value: currencyFormatter(dashboardStats.totalDonations),
          color: [245, 184, 0],
          symbol: "PHP"
        },
        { 
          label: "Total Assets", 
          value: currencyFormatter(dashboardStats.totalAssets),
          color: [245, 184, 0],
          symbol: "VALUE"
        },
        { 
          label: "Pending Withdrawals", 
          value: dashboardStats.pendingWithdrawals.toString(),
          color: [245, 184, 0],
          symbol: "QUEUE"
        },
      ];

      keyMetrics.forEach((metric, index) => {
        const x = margin + (boxWidth + 2.5) * index;
        
        // Gradient-like effect with color
        pdf.setFillColor(metric.color[0], metric.color[1], metric.color[2]);
        pdf.roundedRect(x, yPosition, boxWidth, boxHeight, 3, 3, "F");
        
        // Symbol/Badge
        pdf.setFontSize(7);
        pdf.setTextColor(20, 24, 35);
        pdf.setFont("helvetica", "bold");
        pdf.text(metric.symbol, x + boxWidth / 2, yPosition + 7, { align: "center" });
        
        // Label
        pdf.setFontSize(7);
        pdf.setTextColor(20, 24, 35);
        pdf.setFont("helvetica", "normal");
        pdf.text(metric.label, x + boxWidth / 2, yPosition + 14, { align: "center" });
        
        // Value
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(20, 24, 35);
        pdf.text(metric.value, x + boxWidth / 2, yPosition + 20, { align: "center" });
      });

      yPosition += boxHeight + 15;

      // MANA Reward Overview Section
      addSectionTitle("MANA Reward System Overview");
      
      const rewardBoxWidth = (contentWidth - 5) / 3;
      const rewardBoxHeight = 22;
      
      const rewardMetrics = [
        { 
          label: "Total Mana Codes", 
          value: manaRewardData.totalRewardsGenerated.toLocaleString(),
          subtext: `${manaRewardData.activeRewards} Active`,
          color: [245, 184, 0]
        },
        { 
          label: "Total Claims", 
          value: manaRewardData.totalRewardsClaimed.toLocaleString(),
          subtext: `${manaRewardData.claimRate.toFixed(1)}% Claim Rate`,
          color: [245, 184, 0]
        },
        { 
          label: "Total Claimed Amount", 
          value: currencyFormatter(manaRewardData.totalClaimAmount),
          subtext: `Avg: ${currencyFormatter(manaRewardData.averageClaimAmount)}`,
          color: [245, 184, 0]
        },
      ];

      rewardMetrics.forEach((metric, index) => {
        const x = margin + (rewardBoxWidth + 2.5) * index;
        
        pdf.setFillColor(250, 251, 252);
        pdf.roundedRect(x, yPosition, rewardBoxWidth, rewardBoxHeight, 2, 2, "F");
        
        pdf.setDrawColor(metric.color[0], metric.color[1], metric.color[2]);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(x, yPosition, rewardBoxWidth, rewardBoxHeight, 2, 2, "S");
        
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        pdf.setFont("helvetica", "normal");
        pdf.text(metric.label, x + rewardBoxWidth / 2, yPosition + 5, { align: "center" });
        
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text(metric.value, x + rewardBoxWidth / 2, yPosition + 12, { align: "center" });
        
        pdf.setFontSize(6);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(metric.color[0], metric.color[1], metric.color[2]);
        pdf.text(metric.subtext, x + rewardBoxWidth / 2, yPosition + 18, { align: "center" });
      });

      yPosition += rewardBoxHeight + 12;

      // Key Insights Section
      checkNewPage(50);
      addSectionTitle("Key Insights & Recommendations");
      
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(60, 60, 60);
      
      const insights = [
        `User Growth: ${dashboardStats.totalUsers} registered users with ${manaRewardData.totalRewardsClaimed} reward claims`,
        `Reward Performance: ${manaRewardData.claimRate.toFixed(1)}% claim rate with ${manaRewardData.activeRewards} active rewards`,
        `Financial Overview: PHP ${dashboardStats.totalDonations.toLocaleString()} in donations, PHP ${dashboardStats.totalAssets.toLocaleString()} in assets`,
        `Pending Actions: ${dashboardStats.pendingWithdrawals} withdrawal requests awaiting processing`,
        `Average Claim: ${currencyFormatter(manaRewardData.averageClaimAmount)} per reward claim`,
      ];
      
      insights.forEach((insight, idx) => {
        checkNewPage(10);
        const lines = pdf.splitTextToSize(`${idx + 1}. ${insight}`, contentWidth - 5);
        pdf.text(lines, margin + 3, yPosition);
        yPosition += lines.length * 5;
      });

      yPosition += 10;

      // PAGE 2: Detailed Analytics
      checkNewPage(100);
      addSectionTitle(`${getChartTypeLabel()} - Detailed Analysis`);
      
      // Summary Statistics
      const stats = calculateSummaryStats();
      const statsBoxWidth = (contentWidth - 7.5) / 4;
      const statsBoxHeight = 20;
      
      const statsData = [
        { label: "Current Total", value: chartType === "users" ? stats.total.toString() : currencyFormatter(stats.total) },
        { label: "Average", value: chartType === "users" ? Math.round(stats.average).toString() : currencyFormatter(stats.average) },
        { label: "Highest", value: chartType === "users" ? stats.highest.toString() : currencyFormatter(stats.highest) },
        { label: "Data Points", value: chartData.length.toString() },
      ];

      statsData.forEach((stat, index) => {
        const x = margin + (statsBoxWidth + 2.5) * index;
        
        pdf.setFillColor(245, 247, 250);
        pdf.roundedRect(x, yPosition, statsBoxWidth, statsBoxHeight, 2, 2, "F");
        
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(x, yPosition, statsBoxWidth, statsBoxHeight, 2, 2, "S");
        
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        pdf.setFont("helvetica", "normal");
        pdf.text(stat.label, x + statsBoxWidth / 2, yPosition + 6, { align: "center" });
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text(stat.value, x + statsBoxWidth / 2, yPosition + 14, { align: "center" });
      });

      yPosition += statsBoxHeight + 12;

      // Chart description
      checkNewPage(20);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(80, 80, 80);
      const description = `This section provides detailed analysis of ${getChartTypeLabel().toLowerCase()} over ${getTimeRangeLabel().toLowerCase()}. ` +
        `The visualizations below show trends, patterns, and distribution across different time periods.`;
      const splitDescription = pdf.splitTextToSize(description, contentWidth);
      pdf.text(splitDescription, margin, yPosition);
      yPosition += (splitDescription.length * 5) + 8;

      // Capture charts as image
      const canvas = await html2canvas(reportsRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      checkNewPage(Math.min(imgHeight, 100));

      pdf.addImage(imgData, "PNG", margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;

      // Final Notes Section
      checkNewPage(40);
      addSectionTitle("Report Notes");
      
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      
      const notes = [
        "This report is automatically generated based on real-time data from the KOLI Admin system.",
        "All currency values are displayed in Philippine Peso (PHP) unless otherwise specified.",
        "Reward claim rates are calculated as total claims divided by total rewards generated.",
        "For questions or clarifications, please contact the system administrator.",
        `Report generated on: ${new Date().toLocaleString("en-US")}`,
      ];
      
      notes.forEach((note, idx) => {
        const lines = pdf.splitTextToSize(`${idx + 1}. ${note}`, contentWidth - 5);
        pdf.text(lines, margin + 3, yPosition);
        yPosition += lines.length * 4.5;
      });

      // Update all page footers with correct total pages
      const totalPages = pageNumber;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        addPageFooter(i, totalPages.toString());
      }

      pdf.save(`KOLI-Comprehensive-Report-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  return (
    <div className="h-full bg-background p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">
            View analytics and statistics
          </p>
          {chartData.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground mt-1">
                Data Range: {getDateRangeText()}
              </p>
              <p className="text-xs text-muted-foreground">
                {getAggregationNote()}
              </p>
            </>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleExportPDF}
            variant="outline"
            className="gap-2 w-full sm:w-auto"
            disabled={loading || chartData.length === 0}
          >
            <IconDownload className="h-4 w-4" />
            Export Comprehensive PDF
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

      <div ref={reportsRef} className="space-y-6">
        {loading ? (
          <div className="flex justify-center items-center h-[300px]">
            <p className="text-muted-foreground">Loading charts...</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex justify-center items-center h-[300px]">
            <p className="text-muted-foreground">No data available for the selected time range</p>
          </div>
        ) : (
          <>
      
        {/* Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Line Chart - {getChartLabel()}</CardTitle>
            <CardDescription>{getTimeRangeLabel()}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <LineChart
                accessibilityLayer
                data={(() => {
                  const mappedData = chartData.map((d) => ({
                    date: d.date,
                    dateTime: d.date.getTime(),
                    value: chartType === "users" ? (d.count || 0) : (d.amount || 0),
                  }));
                  console.log(`📊 Line Chart mapped data (first  3):`, mappedData.slice(0, 3));
                  return mappedData;
                })()}
                margin={{
                  left: 12,
                  right: 12,
                }}              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="dateTime"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return getDateFormatter(timeRange)(date);
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  domain={[0, 'dataMax + 1']}
                  allowDataOverflow={false}
                  tickFormatter={(value) =>
                    chartType === "users"
                      ? String(Math.round(value))
                      : currencyFormatter(value)
                  }
                />
                <ChartTooltip
                  cursor={false}
                  content={<CustomChartTooltip currencyFormatter={currencyFormatter} chartType={chartType} />}
                />
                <Line
                  dataKey="value"
                  type="natural"
                  stroke={getChartColor()}
                  strokeWidth={2}
                  dot={chartData.length <= 30 ? {
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
        <Card>
          <CardHeader>
            <CardTitle>Bar Chart - {getChartLabel()}</CardTitle>
            <CardDescription>{getTimeRangeLabel()}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart
                accessibilityLayer
                data={(() => {
                  const mappedData = chartData.map((d) => ({
                    date: d.date,
                    dateTime: d.date.getTime(),
                    value: chartType === "users" ? (d.count || 0) : (d.amount || 0),
                  }));
                  console.log(`📊 Bar Chart mapped data (first 3):`, mappedData.slice(0, 3));
                  return mappedData;
                })()}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="dateTime"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return getDateFormatter(timeRange)(date);
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  domain={[0, 'dataMax + 1']}
                  allowDataOverflow={false}
                  tickFormatter={(value) =>
                    chartType === "users"
                      ? String(Math.round(value))
                      : currencyFormatter(value)
                  }
                />
                <ChartTooltip
                  content={<CustomChartTooltip currencyFormatter={currencyFormatter} chartType={chartType} />}
                />
                <Bar dataKey="value" fill={getChartColor()} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>Distribution Chart - {getChartLabel()}</CardTitle>
            <CardDescription>{getTimeRangeLabel()}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer
              config={(() => {
                // Get non-zero incremental values grouped by month
                const monthlyData = new Map<string, number>();
                
                for (let i = 0; i < chartData.length; i++) {
                  const currentValue = chartType === "users" ? (chartData[i].count || 0) : (chartData[i].amount || 0);
                  const previousValue = i > 0 
                    ? (chartType === "users" ? (chartData[i - 1].count || 0) : (chartData[i - 1].amount || 0))
                    : 0;
                  const increment = currentValue - previousValue;
                  
                  if (increment > 0) {
                    const monthKey = new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      year: "numeric",
                    }).format(chartData[i].date);
                    
                    monthlyData.set(monthKey, (monthlyData.get(monthKey) || 0) + increment);
                  }
                }
                
                // Build config dynamically
                const config: ChartConfig = { value: { label: getChartLabel() } };
                Array.from(monthlyData.entries())
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .forEach(([month], idx) => {
                    config[`month${idx}`] = {
                      label: month,
                      color: `var(--chart-${(idx % 5) + 1})`,
                    };
                  });
                
                return config;
              })()}
              className="mx-auto aspect-square max-h-[300px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel formatter={(value) =>
                    chartType === "users"
                      ? String(value)
                      : currencyFormatter(value as number)
                  } />}
                />
                <Pie
                  data={(() => {
                    // Get non-zero incremental values grouped by month
                    const monthlyData = new Map<string, number>();
                    
                    for (let i = 0; i < chartData.length; i++) {
                      const currentValue = chartType === "users" ? (chartData[i].count || 0) : (chartData[i].amount || 0);
                      const previousValue = i > 0 
                        ? (chartType === "users" ? (chartData[i - 1].count || 0) : (chartData[i - 1].amount || 0))
                        : 0;
                      const increment = currentValue - previousValue;
                      
                      if (increment > 0) {
                        const monthKey = new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          year: "numeric",
                        }).format(chartData[i].date);
                        
                        monthlyData.set(monthKey, (monthlyData.get(monthKey) || 0) + increment);
                      }
                    }
                    
                    // Convert to array and take top 8 entries
                    return Array.from(monthlyData.entries())
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 8)
                      .map(([month, value], idx) => ({
                        month: month,
                        value: value,
                        fill: `var(--chart-${(idx % 5) + 1})`,
                      }));
                  })()}
                  dataKey="value"
                  nameKey="month"
                  innerRadius={60}
                  strokeWidth={5}
                >
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        const stats = calculateSummaryStats();
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy}
                              className="fill-foreground text-3xl font-bold"
                            >
                              {chartType === "users" 
                                ? stats.total.toLocaleString()
                                : currencyFormatter(stats.total).replace("PHP ", "₱")
                              }
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 24}
                              className="fill-muted-foreground"
                            >
                              {getChartLabel()}
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
          <div className="flex-col gap-2 text-sm p-6 pt-3">
            {calculateTrend() !== 0 && (
              <div className="flex items-center gap-2 leading-none font-medium">
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
