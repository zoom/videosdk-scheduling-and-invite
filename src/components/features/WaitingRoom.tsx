import Spinner from '../Spinner'

const WaitingRoom = () => (
  <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-gray-100">
    <Spinner size={96} />
    <p className="text-lg font-medium text-gray-700">Waiting for host to admit you...</p>
  </div>
)

export default WaitingRoom
