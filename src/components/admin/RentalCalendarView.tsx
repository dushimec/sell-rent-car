import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarRange,
  CarFront,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Layers,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { RentalBooking, UserProfile, Vehicle } from '../../types/autosuite';
import {
  bookingCoversDateKey,
  findBookingConflictIds,
  getDaysInMonth,
  getMonthGridDays,
  getRentalFleetVehicles,
  toDateKey,
} from '../../utils/calendarUtils';
import { DEFAULT_CURRENCY, formatMoney } from '../../utils/money';
import { hasDateRangeOverlap } from '../../utils/rentalCalc';

interface RentalCalendarViewProps {
  bookings: RentalBooking[];
  vehicles: Vehicle[];
  profile: UserProfile;
  currency?: string;
  onApproveBooking: (bookingId: string) => Promise<void>;
  onRejectBooking: (bookingId: string) => Promise<void>;
  onTransitionBooking: (
    bookingId: string,
    nextStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  ) => Promise<void>;
  onRecordPayment: (bookingId: string) => void;
  onOpenContract: (booking: RentalBooking) => void;
}

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_BADGE_CLASSES: Record<string, string> = {
  ACTIVE: 'bg-[#20D94B]/15 text-[#20D94B] border-[#20D94B]/40',
  CONFIRMED: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  PENDING: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  COMPLETED: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/40',
  CANCELLED: 'bg-[#171717] text-[#A6A6A6] border-[#353535]',
  REJECTED: 'bg-red-500/15 text-red-400 border-red-500/40',
};

export function RentalCalendarView({
  bookings,
  vehicles,
  currency = DEFAULT_CURRENCY,
  onApproveBooking,
  onRejectBooking,
  onTransitionBooking,
  onRecordPayment,
  onOpenContract,
}: RentalCalendarViewProps) {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  const [viewLayout, setViewLayout] = useState<'month' | 'timeline'>('month');
  const [cursorYear, setCursorYear] = useState<number>(today.getFullYear());
  const [cursorMonth, setCursorMonth] = useState<number>(today.getMonth());
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('ALL');
  const [includePending, setIncludePending] = useState<boolean>(true);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

  // Interactive double-booking range checker state
  const [rangeStartKey, setRangeStartKey] = useState<string>('');
  const [rangeEndKey, setRangeEndKey] = useState<string>('');
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);

  const fleetVehicles = useMemo(
    () => getRentalFleetVehicles(vehicles, bookings),
    [vehicles, bookings]
  );

  // All bookings that hold or request schedule dates (exclude rejected/cancelled)
  const scheduledBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === 'CANCELLED' || b.status === 'REJECTED') return false;
      if (!includePending && b.status === 'PENDING') return false;
      if (selectedVehicleId !== 'ALL' && b.vehicleId !== selectedVehicleId) return false;
      return true;
    });
  }, [bookings, includePending, selectedVehicleId]);

  const conflictIds = useMemo(() => findBookingConflictIds(bookings), [bookings]);

  const monthCells = useMemo(
    () => getMonthGridDays(cursorYear, cursorMonth, today),
    [cursorYear, cursorMonth, today]
  );

  const monthOnlyDays = useMemo(
    () => getDaysInMonth(cursorYear, cursorMonth, today),
    [cursorYear, cursorMonth, today]
  );

  const monthLabel = useMemo(() => {
    return new Date(cursorYear, cursorMonth, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }, [cursorYear, cursorMonth]);

  const visibleFleetRows = useMemo(() => {
    if (selectedVehicleId === 'ALL') return fleetVehicles;
    return fleetVehicles.filter((v) => v.id === selectedVehicleId);
  }, [fleetVehicles, selectedVehicleId]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, RentalBooking[]>();
    for (const cell of monthCells) {
      const list = scheduledBookings
        .filter((b) => bookingCoversDateKey(b, cell.dateKey))
        .sort((a, b) => {
          const priority = (s: string) => (s === 'ACTIVE' ? 0 : s === 'CONFIRMED' ? 1 : 2);
          return priority(a.status) - priority(b.status);
        });
      map.set(cell.dateKey, list);
    }
    return map;
  }, [monthCells, scheduledBookings]);

  const selectedDayBookings = useMemo(() => {
    return scheduledBookings
      .filter((b) => bookingCoversDateKey(b, selectedDateKey))
      .sort((a, b) => a.pickupAt.localeCompare(b.pickupAt));
  }, [scheduledBookings, selectedDateKey]);

  const availableVehiclesOnSelectedDay = useMemo(() => {
    const busyIds = new Set(
      bookings
        .filter(
          (b) =>
            (b.status === 'CONFIRMED' || b.status === 'ACTIVE') &&
            bookingCoversDateKey(b, selectedDateKey)
        )
        .map((b) => b.vehicleId)
    );
    return visibleFleetRows.filter((v) => !busyIds.has(v.id));
  }, [bookings, selectedDateKey, visibleFleetRows]);

  // Interactive range conflict pre-check
  const rangeCheckResult = useMemo(() => {
    if (!rangeStartKey) return null;
    const endKey = rangeEndKey || rangeStartKey;
    const startIso = `${rangeStartKey}T09:00`;
    const endIso = `${endKey}T18:00`;

    const lockedSlotsByVehicle = new Map<
      string,
      Array<{ bookingId: string; pickupAt: string; returnAt: string }>
    >();
    for (const b of bookings) {
      if (b.status !== 'CONFIRMED' && b.status !== 'ACTIVE') continue;
      const arr = lockedSlotsByVehicle.get(b.vehicleId) || [];
      arr.push({ bookingId: b.id, pickupAt: b.pickupAt, returnAt: b.returnAt });
      lockedSlotsByVehicle.set(b.vehicleId, arr);
    }

    const freeVehicles: Vehicle[] = [];
    const blockedVehicles: Vehicle[] = [];

    for (const v of visibleFleetRows) {
      const slots = lockedSlotsByVehicle.get(v.id) || [];
      if (hasDateRangeOverlap(startIso, endIso, slots)) {
        blockedVehicles.push(v);
      } else {
        freeVehicles.push(v);
      }
    }

    return {
      startKey: rangeStartKey,
      endKey,
      freeVehicles,
      blockedVehicles,
    };
  }, [rangeStartKey, rangeEndKey, bookings, visibleFleetRows]);

  const goPrevMonth = () => {
    if (cursorMonth === 0) {
      setCursorYear((y) => y - 1);
      setCursorMonth(11);
    } else {
      setCursorMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (cursorMonth === 11) {
      setCursorYear((y) => y + 1);
      setCursorMonth(0);
    } else {
      setCursorMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setCursorYear(today.getFullYear());
    setCursorMonth(today.getMonth());
    setSelectedDateKey(todayKey);
  };

  const handleDayClick = (cellDateKey: string) => {
    setSelectedDateKey(cellDateKey);
  };

  const handleRangeTap = (dateKey: string) => {
    if (!rangeStartKey || (rangeStartKey && rangeEndKey)) {
      setRangeStartKey(dateKey);
      setRangeEndKey('');
    } else if (dateKey < rangeStartKey) {
      setRangeEndKey(rangeStartKey);
      setRangeStartKey(dateKey);
    } else {
      setRangeEndKey(dateKey);
    }
  };

  const runAction = async (bookingId: string, fn: () => Promise<void>) => {
    setBusyBookingId(bookingId);
    try {
      await fn();
    } finally {
      setBusyBookingId(null);
    }
  };

  // Summary counts for visible filters
  const lockedCount = scheduledBookings.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'ACTIVE'
  ).length;
  const pendingCount = scheduledBookings.filter((b) => b.status === 'PENDING').length;
  const visibleConflictCount = scheduledBookings.filter((b) => conflictIds.has(b.id)).length;
  const bookedTodayCount = new Set(
    bookings
      .filter(
        (b) =>
          (b.status === 'CONFIRMED' || b.status === 'ACTIVE') &&
          bookingCoversDateKey(b, todayKey)
      )
      .map((b) => b.vehicleId)
  ).size;

  return (
    <div className="space-y-5">
      {/* Calendar KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-4">
          <p className="text-xs text-[#A6A6A6]">Confirmed / Active Rentals</p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-[#20D94B] mt-1">
            {lockedCount}
          </p>
        </div>
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-4">
          <p className="text-xs text-[#A6A6A6]">Pending Requests</p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-amber-400 mt-1">
            {pendingCount}
          </p>
        </div>
        <div className="bg-[#202020] border border-[#353535] rounded-2xl p-4">
          <p className="text-xs text-[#A6A6A6]">Vehicles Out Today</p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-white mt-1">
            {bookedTodayCount} / {fleetVehicles.length}
          </p>
        </div>
        <div
          className={`rounded-2xl p-4 border ${
            visibleConflictCount > 0
              ? 'bg-red-500/10 border-red-500/40'
              : 'bg-[#202020] border-[#353535]'
          }`}
        >
          <p className="text-xs text-[#A6A6A6]">Overlap Conflicts Detected</p>
          <p
            className={`text-2xl font-extrabold font-mono tabular-nums mt-1 ${
              visibleConflictCount > 0 ? 'text-red-400' : 'text-[#20D94B]'
            }`}
          >
            {visibleConflictCount}
          </p>
        </div>
      </div>

      {/* Controls & Legend */}
      <div className="bg-[#202020] border border-[#353535] rounded-2xl p-4 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Month Nav */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={goPrevMonth}
              aria-label="Previous month"
              className="w-9 h-9 rounded-xl bg-[#171717] border border-[#353535] text-white hover:border-[#20D94B] inline-flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="text-base font-extrabold text-white min-w-[165px] text-center">
              {monthLabel}
            </h3>
            <button
              type="button"
              onClick={goNextMonth}
              aria-label="Next month"
              className="w-9 h-9 rounded-xl bg-[#171717] border border-[#353535] text-white hover:border-[#20D94B] inline-flex items-center justify-center cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="h-9 px-3.5 rounded-xl bg-[#171717] border border-[#353535] text-xs font-semibold text-white hover:border-[#20D94B] cursor-pointer"
            >
              Today
            </button>
          </div>

          {/* Vehicle Filter & Layout Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              aria-label="Filter calendar by vehicle"
              className="h-9 px-3 rounded-xl bg-[#171717] border border-[#353535] text-xs text-white max-w-xs focus:outline-none focus:border-[#20D94B]"
            >
              <option value="ALL">All Rental Vehicles ({fleetVehicles.length})</option>
              {fleetVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>

            <label className="inline-flex items-center gap-2 text-xs text-[#A6A6A6] hover:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includePending}
                onChange={(e) => setIncludePending(e.target.checked)}
                className="accent-[#20D94B] rounded"
              />
              Show Pending Requests
            </label>

            <div className="flex bg-[#171717] border border-[#353535] rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setViewLayout('month')}
                className={`px-3 py-1 rounded-lg font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  viewLayout === 'month' ? 'bg-[#20D94B] text-[#080808]' : 'text-[#A6A6A6]'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                Month Grid
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('timeline')}
                className={`px-3 py-1 rounded-lg font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  viewLayout === 'timeline' ? 'bg-[#20D94B] text-[#080808]' : 'text-[#A6A6A6]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Fleet Matrix
              </button>
            </div>
          </div>
        </div>

        {/* Status Color Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#353535] text-[11px] text-[#A6A6A6]">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#20D94B]" />
              Active (On Road)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
              Confirmed (Locked)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
              Pending Approval
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
              Overlap Conflict (Blocked)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <CalendarRange className="w-3.5 h-3.5 text-[#20D94B]" />
            <span>Click any day to inspect bookings or test a date range below.</span>
          </div>
        </div>
      </div>

      {/* Main Split: Calendar Board + Day & Double-Booking Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 min-w-0 space-y-5">
          {viewLayout === 'month' ? (
            <div className="bg-[#202020] border border-[#353535] rounded-2xl overflow-hidden">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 border-b border-[#353535] bg-[#171717]">
                {WEEKDAY_HEADERS.map((day) => (
                  <div
                    key={day}
                    className="py-2.5 px-2 text-center text-[11px] font-bold uppercase tracking-wider text-[#A6A6A6]"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 42-Day Interactive Grid */}
              <div className="grid grid-cols-7">
                {monthCells.map((cell) => {
                  const dayBookings = bookingsByDate.get(cell.dateKey) || [];
                  const hasLocked = dayBookings.some(
                    (b) => b.status === 'CONFIRMED' || b.status === 'ACTIVE'
                  );
                  const hasPendingOnly =
                    !hasLocked && dayBookings.some((b) => b.status === 'PENDING');
                  const hasConflict = dayBookings.some((b) => conflictIds.has(b.id));
                  const isSelected = cell.dateKey === selectedDateKey;
                  const inTestRange =
                    rangeStartKey &&
                    cell.dateKey >= rangeStartKey &&
                    cell.dateKey <= (rangeEndKey || rangeStartKey);

                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      onClick={() => handleDayClick(cell.dateKey)}
                      className={`min-h-[96px] sm:min-h-[112px] p-1.5 sm:p-2 border-r border-b border-[#353535] text-left flex flex-col justify-between gap-1.5 transition cursor-pointer relative ${
                        !cell.inCurrentMonth ? 'bg-[#121212] opacity-55' : 'bg-[#1B1B1B]'
                      } ${
                        hasConflict
                          ? 'ring-1 ring-inset ring-red-500/70 bg-red-500/5'
                          : hasLocked
                            ? 'bg-[#1F2922]/55'
                            : hasPendingOnly
                              ? 'bg-amber-500/5'
                              : ''
                      } ${
                        isSelected
                          ? 'ring-2 ring-inset ring-[#20D94B]'
                          : inTestRange
                            ? 'ring-1 ring-inset ring-sky-400/70'
                            : 'hover:bg-[#242424]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 w-full">
                        <span
                          className={`text-xs font-mono tabular-nums font-bold px-1.5 py-0.5 rounded ${
                            cell.isToday
                              ? 'bg-[#20D94B] text-[#080808]'
                              : cell.inCurrentMonth
                                ? 'text-white'
                                : 'text-[#A6A6A6]'
                          }`}
                        >
                          {cell.dayOfMonth}
                        </span>

                        <div className="flex items-center gap-1">
                          {hasConflict && (
                            <span
                              title="Double-booking overlap conflict detected"
                              className="text-red-400"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {dayBookings.length > 0 && (
                            <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-[#171717] border border-[#353535] text-[#A6A6A6]">
                              {dayBookings.length}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Booked Vehicle Chips */}
                      <div className="space-y-1 w-full overflow-hidden">
                        {dayBookings.slice(0, 2).map((b) => {
                          const isConflicted = conflictIds.has(b.id);
                          const pillClass = isConflicted
                            ? 'bg-red-500/20 border-red-500/60 text-red-300'
                            : b.status === 'ACTIVE'
                              ? 'bg-[#20D94B]/20 border-[#20D94B]/50 text-[#20D94B]'
                              : b.status === 'CONFIRMED'
                                ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                                : b.status === 'PENDING'
                                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                                  : 'bg-[#171717] border-[#353535] text-[#A6A6A6]';

                          return (
                            <div
                              key={b.id}
                              title={`${b.vehicleName} — ${b.customerName} (${b.status})`}
                              className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold truncate ${pillClass}`}
                            >
                              {b.vehicleName.replace(/^\d{4}\s+/, '')}
                            </div>
                          );
                        })}
                        {dayBookings.length > 2 && (
                          <p className="text-[10px] font-mono text-[#A6A6A6] pl-1">
                            +{dayBookings.length - 2} more
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Fleet Timeline Matrix View (Vehicles × Month Days) */
            <div className="bg-[#202020] border border-[#353535] rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-[#353535] flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-white">
                  Fleet Allocation Matrix — {monthLabel}
                </p>
                <p className="text-[11px] text-[#A6A6A6]">
                  Red cells indicate overlapping requests on a locked vehicle.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#171717] border-b border-[#353535]">
                      <th className="sticky left-0 z-10 bg-[#171717] px-3 py-2.5 text-left font-bold text-white min-w-[180px] border-r border-[#353535]">
                        Rental Vehicle
                      </th>
                      {monthOnlyDays.map((d) => (
                        <th
                          key={d.dateKey}
                          onClick={() => setSelectedDateKey(d.dateKey)}
                          className={`min-w-[30px] py-2 text-center font-mono text-[10px] cursor-pointer border-r border-[#353535]/50 ${
                            d.dateKey === selectedDateKey
                              ? 'bg-[#20D94B] text-[#080808] font-bold'
                              : d.isToday
                                ? 'text-[#20D94B] font-bold'
                                : 'text-[#A6A6A6]'
                          }`}
                        >
                          {d.dayOfMonth}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFleetRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={monthOnlyDays.length + 1}
                          className="p-8 text-center text-xs text-[#A6A6A6]"
                        >
                          No rental vehicles configured in inventory.
                        </td>
                      </tr>
                    ) : (
                      visibleFleetRows.map((vehicle) => {
                        const vehicleBookings = scheduledBookings.filter(
                          (b) => b.vehicleId === vehicle.id
                        );

                        return (
                          <tr
                            key={vehicle.id}
                            className="border-b border-[#353535] hover:bg-[#1B1B1B]"
                          >
                            <td className="sticky left-0 z-10 bg-[#202020] px-3 py-2.5 border-r border-[#353535] min-w-[180px]">
                              <p className="font-bold text-white truncate max-w-[175px]">
                                {vehicle.name}
                              </p>
                              <p className="text-[10px] text-[#A6A6A6] font-mono">
                                {formatMoney(vehicle.rentalPricePerDayCents, currency)}/day
                              </p>
                            </td>
                            {monthOnlyDays.map((d) => {
                              const matching = vehicleBookings.filter((b) =>
                                bookingCoversDateKey(b, d.dateKey)
                              );
                              const lockedMatches = matching.filter(
                                (b) => b.status === 'CONFIRMED' || b.status === 'ACTIVE'
                              );
                              const hasConflictHere =
                                lockedMatches.length > 1 ||
                                (lockedMatches.length >= 1 &&
                                  matching.some((b) => b.status === 'PENDING'));

                              let cellBg = 'bg-transparent hover:bg-[#2A2A2A]';
                              if (hasConflictHere) {
                                cellBg = 'bg-red-500/45 hover:bg-red-500/60';
                              } else if (matching.some((b) => b.status === 'ACTIVE')) {
                                cellBg = 'bg-[#20D94B]/40 hover:bg-[#20D94B]/60';
                              } else if (matching.some((b) => b.status === 'CONFIRMED')) {
                                cellBg = 'bg-sky-500/35 hover:bg-sky-500/55';
                              } else if (matching.some((b) => b.status === 'PENDING')) {
                                cellBg = 'bg-amber-500/35 hover:bg-amber-500/55';
                              }

                              const tooltip = matching
                                .map((m) => `${m.bookingReference}: ${m.customerName} (${m.status})`)
                                .join(' | ');

                              return (
                                <td
                                  key={d.dateKey}
                                  title={tooltip || `${vehicle.name} — Available on ${d.dateKey}`}
                                  onClick={() => setSelectedDateKey(d.dateKey)}
                                  className={`h-10 border-r border-[#353535]/50 cursor-pointer text-center font-mono text-[10px] transition ${cellBg} ${
                                    d.dateKey === selectedDateKey
                                      ? 'ring-1 ring-inset ring-[#20D94B]'
                                      : ''
                                  }`}
                                >
                                  {hasConflictHere ? '!' : matching.length > 0 ? matching.length : ''}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quick Range Availability Checker */}
          <div className="bg-[#202020] border border-[#353535] rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#20D94B]" />
                  Double-Booking Guard &amp; Availability Checker
                </h4>
                <p className="text-xs text-[#A6A6A6] mt-0.5">
                  Test any date window to see which vehicles are free vs locked by existing bookings.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={rangeStartKey}
                  onChange={(e) => setRangeStartKey(e.target.value)}
                  aria-label="Check start date"
                  className="h-9 px-2.5 rounded-lg bg-[#171717] border border-[#353535] text-xs font-mono text-white"
                />
                <span className="text-xs text-[#A6A6A6]">to</span>
                <input
                  type="date"
                  value={rangeEndKey}
                  min={rangeStartKey}
                  onChange={(e) => setRangeEndKey(e.target.value)}
                  aria-label="Check end date"
                  className="h-9 px-2.5 rounded-lg bg-[#171717] border border-[#353535] text-xs font-mono text-white"
                />
                <button
                  type="button"
                  onClick={() => handleRangeTap(selectedDateKey)}
                  className="h-9 px-3 rounded-lg bg-[#171717] border border-[#353535] text-xs font-semibold text-[#20D94B] hover:border-[#20D94B] cursor-pointer"
                >
                  Use Selected Day
                </button>
                {(rangeStartKey || rangeEndKey) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRangeStartKey('');
                      setRangeEndKey('');
                    }}
                    className="h-9 px-2.5 rounded-lg text-xs text-[#A6A6A6] hover:text-white cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {rangeCheckResult && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-xl bg-[#171717] border border-[#20D94B]/30 space-y-2">
                  <p className="text-xs font-bold text-[#20D94B]">
                    Available ({rangeCheckResult.freeVehicles.length}) · {rangeCheckResult.startKey} →{' '}
                    {rangeCheckResult.endKey}
                  </p>
                  {rangeCheckResult.freeVehicles.length === 0 ? (
                    <p className="text-xs text-[#A6A6A6]">No vehicles free across these dates.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {rangeCheckResult.freeVehicles.map((v) => (
                        <span
                          key={v.id}
                          className="px-2 py-1 rounded bg-[#202020] border border-[#353535] text-[11px] text-white"
                        >
                          {v.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-[#171717] border border-red-500/30 space-y-2">
                  <p className="text-xs font-bold text-red-400">
                    Booked / Blocked ({rangeCheckResult.blockedVehicles.length})
                  </p>
                  {rangeCheckResult.blockedVehicles.length === 0 ? (
                    <p className="text-xs text-[#A6A6A6]">Zero conflicting reservations.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {rangeCheckResult.blockedVehicles.map((v) => (
                        <span
                          key={v.id}
                          className="px-2 py-1 rounded bg-red-500/10 border border-red-500/30 text-[11px] text-red-300"
                        >
                          {v.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Selected Day Inspector */}
        <aside className="xl:col-span-4 bg-[#202020] border border-[#353535] rounded-2xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-[#353535] pb-4">
            <div>
              <p className="text-xs font-semibold text-[#20D94B] uppercase tracking-wider">
                Day Schedule
              </p>
              <h3 className="text-lg font-extrabold font-mono text-white mt-0.5">
                {selectedDateKey}
              </h3>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#171717] border border-[#353535] text-white">
              {selectedDayBookings.length} booking{selectedDayBookings.length === 1 ? '' : 's'}
            </span>
          </div>

          {selectedDayBookings.length === 0 ? (
            <div className="p-5 rounded-xl bg-[#171717] border border-[#353535] text-center space-y-1.5">
              <CheckCircle2 className="w-5 h-5 text-[#20D94B] mx-auto" />
              <p className="text-xs font-bold text-white">All Filtered Vehicles Free</p>
              <p className="text-[11px] text-[#A6A6A6]">
                No booked or pending rentals overlap {selectedDateKey}.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
              {selectedDayBookings.map((b) => {
                const isConflict = conflictIds.has(b.id);
                const busy = busyBookingId === b.id;

                return (
                  <div
                    key={b.id}
                    className={`p-4 rounded-xl bg-[#171717] border space-y-3 text-xs ${
                      isConflict ? 'border-red-500/60' : 'border-[#353535]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] text-[#A6A6A6]">
                          {b.bookingReference || `#${b.id.slice(0, 8).toUpperCase()}`}
                        </p>
                        <p className="font-bold text-white text-sm truncate">{b.vehicleName}</p>
                        <p className="text-[#A6A6A6] mt-0.5 truncate">
                          {b.customerName}
                          {b.customerPhone ? ` · ${b.customerPhone}` : ''}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-bold shrink-0 ${
                          STATUS_BADGE_CLASSES[b.status] || 'border-[#353535] text-white'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>

                    <div className="space-y-1 font-mono text-[11px] text-[#A6A6A6]">
                      <p className="flex items-center gap-1.5 text-white">
                        <Clock className="w-3.5 h-3.5 text-[#20D94B]" />
                        {b.pickupAt.replace('T', ' ')} → {b.returnAt.replace('T', ' ')}
                      </p>
                      <p className="truncate">
                        {b.pickupLocation} → {b.returnLocation}
                      </p>
                      <p className="text-[#20D94B] font-bold">
                        {formatMoney(b.totalAmountCents, b.currency)} ({b.days}d)
                      </p>
                    </div>

                    {isConflict && (
                      <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/40 text-[11px] text-red-300 flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          Overlap detected with a locked booking for {b.vehicleName}. Approving is
                          blocked to prevent double-booking.
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {b.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            disabled={busy || isConflict}
                            onClick={() => void runAction(b.id, () => onApproveBooking(b.id))}
                            className="px-2.5 py-1.5 rounded-lg bg-[#20D94B] text-[#080808] font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void runAction(b.id, () => onRejectBooking(b.id))}
                            className="px-2.5 py-1.5 rounded-lg border border-red-500/40 text-red-400 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                          >
                            <XCircle className="w-3 h-3" />
                            Reject
                          </button>
                        </>
                      )}

                      {b.status === 'CONFIRMED' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction(b.id, () => onTransitionBooking(b.id, 'ACTIVE'))
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#20D94B] text-[#080808] font-bold text-[11px] cursor-pointer disabled:opacity-40"
                        >
                          Mark Picked Up
                        </button>
                      )}

                      {b.status === 'ACTIVE' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction(b.id, () => onTransitionBooking(b.id, 'COMPLETED'))
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#20D94B] text-[#080808] font-bold text-[11px] cursor-pointer disabled:opacity-40"
                        >
                          Complete Return
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onRecordPayment(b.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#202020] border border-[#353535] text-[#20D94B] font-semibold text-[11px] cursor-pointer"
                      >
                        Payment
                      </button>

                      {b.contractReference && (
                        <button
                          type="button"
                          onClick={() => onOpenContract(b)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#202020] border border-[#353535] text-white font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          Contract
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Available Vehicles Summary for Selected Date */}
          <div className="pt-4 border-t border-[#353535] space-y-2.5">
            <p className="text-xs font-bold text-white flex items-center gap-1.5">
              <CarFront className="w-3.5 h-3.5 text-[#20D94B]" />
              Available on {selectedDateKey} ({availableVehiclesOnSelectedDay.length})
            </p>
            {availableVehiclesOnSelectedDay.length === 0 ? (
              <p className="text-[11px] text-[#A6A6A6]">
                Every filtered rental vehicle has a locked booking on this date.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {availableVehiclesOnSelectedDay.map((v) => (
                  <span
                    key={v.id}
                    className="px-2.5 py-1 rounded-lg bg-[#171717] border border-[#353535] text-[11px] text-[#A6A6A6]"
                  >
                    {v.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
