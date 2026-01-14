import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * Enhanced Stat Card Component
 * Reusable card for displaying statistics with icon, value, and optional trend
 */
const StatCard = ({ title, value, icon, color = 'bg-primary-50', trend, trendUp = true }) => {
    return (
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${color}`}>
                    {icon}
                </div>
                {trend && (
                    <span className={`flex items-center text-sm font-medium ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
                        {trendUp ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                        {trend}
                    </span>
                )}
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
    );
};

export default StatCard;
