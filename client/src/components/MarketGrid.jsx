import MarketCard from './MarketCard';

const KEYS = ['kospi', 'kosdaq', 'usdkrw', 'oil', 'btc', 'sp500', 'nasdaq', 'dow'];

export default function MarketGrid({ data }) {
  if (!data) return null;
  const sparklines = data.sparklines || {};
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-4">
      {KEYS.map(key => data[key] && (
        <MarketCard key={key} {...data[key]} sparkline={sparklines[key]} status={data[key].status} />
      ))}
    </div>
  );
}
