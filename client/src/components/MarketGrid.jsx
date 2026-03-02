import MarketCard from './MarketCard';

const KEYS = ['kospi', 'kosdaq', 'usdkrw', 'oil', 'btc', 'sp500', 'nasdaq', 'dow'];

export default function MarketGrid({ data }) {
  if (!data) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
      {KEYS.map(key => data[key] && (
        <MarketCard key={key} {...data[key]} />
      ))}
    </div>
  );
}
