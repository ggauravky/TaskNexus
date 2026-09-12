import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * Enhanced Stat Card Component
 * Reusable card for displaying statistics with icon, value, and optional trend
 */
const StatCard = ({ title, value, icon, color = 'bg-primary-50', trend, trendUp = true }) => {
    return (
        <div className="rounded-xl border border-[#23252a] bg-[#0f1011] p-5 transition-colors hover:border-[#34343a]">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${color}`}>
                    {icon}
                </div>
                {trend && (
                    <span className={`flex items-center text-sm font-medium ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
                        {trendUp ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                        {trend}
                    </span>
                )}
            </div>
            <h3 className="mb-1 text-sm font-medium text-[#8a8f98]">{title}</h3>
            <p className="text-2xl font-semibold text-[#f7f8f8]">{value}</p>
        </div>
    );
};

export default StatCard;
