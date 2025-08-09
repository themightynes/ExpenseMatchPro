interface StatsCardProps {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  value: string;
}

export default function StatsCard({ icon, iconColor, iconBg, title, value }: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <div className="flex items-center">
        <div className={`p-2 ${iconBg} rounded-lg`}>
          <i className={`${icon} ${iconColor} text-xl`}></i>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
