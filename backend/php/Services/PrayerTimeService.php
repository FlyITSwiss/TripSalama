<?php
declare(strict_types=1);
namespace TripSalama\Services;
use PDO;

class PrayerTimeService
{
    private PDO $db;
    private string $apiUrl;
    private int $calculationMethod;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->apiUrl = $_ENV['PRAYER_API_URL'] ?? 'https://api.aladhan.com/v1';
        $this->calculationMethod = (int) ($_ENV['PRAYER_CALCULATION_METHOD'] ?? 21);
    }

    public function getPrayerTimes(float $lat, float $lng, ?string $date = null): array
    {
        $date = $date ?? date('d-m-Y');
        $url = "{$this->apiUrl}/timings/{$date}?latitude={$lat}&longitude={$lng}&method={$this->calculationMethod}";
        $ch = curl_init();
        curl_setopt_array($ch, [CURLOPT_URL => $url, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
        $response = curl_exec($ch);
        curl_close($ch);
        $data = json_decode($response, true);
        if (!$data || $data['code'] !== 200) return $this->getDefaultTimes();
        return [
            'fajr' => $data['data']['timings']['Fajr'],
            'sunrise' => $data['data']['timings']['Sunrise'],
            'dhuhr' => $data['data']['timings']['Dhuhr'],
            'asr' => $data['data']['timings']['Asr'],
            'maghrib' => $data['data']['timings']['Maghrib'],
            'isha' => $data['data']['timings']['Isha'],
        ];
    }

    public function isPrayerTime(float $lat, float $lng, int $pauseMinutes = 15): array
    {
        $times = $this->getPrayerTimes($lat, $lng);
        $now = new \DateTime();
        foreach ($times as $prayer => $prayerTime) {
            if ($prayer === 'sunrise') continue;
            $prayerDateTime = \DateTime::createFromFormat('H:i', substr($prayerTime, 0, 5));
            $endTime = clone $prayerDateTime;
            $endTime->modify("+{$pauseMinutes} minutes");
            if ($now >= $prayerDateTime && $now <= $endTime) {
                return ['is_prayer_time' => true, 'prayer' => $prayer, 'resumes_in' => $endTime->getTimestamp() - $now->getTimestamp()];
            }
        }
        return ['is_prayer_time' => false];
    }

    public function togglePrayerPause(int $driverId, bool $enabled): bool
    {
        $stmt = $this->db->prepare('UPDATE driver_status SET prayer_pause_enabled = :enabled WHERE driver_id = :driver_id');
        return $stmt->execute(['driver_id' => $driverId, 'enabled' => $enabled ? 1 : 0]);
    }

    public function isDriverAvailable(int $driverId, float $lat, float $lng): array
    {
        $stmt = $this->db->prepare('SELECT prayer_pause_enabled FROM driver_status WHERE driver_id = :driver_id');
        $stmt->execute(['driver_id' => $driverId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$result || !(bool)$result['prayer_pause_enabled']) return ['available' => true];
        $prayerStatus = $this->isPrayerTime($lat, $lng);
        if ($prayerStatus['is_prayer_time']) {
            return ['available' => false, 'reason' => 'prayer_time', 'prayer' => $prayerStatus['prayer'], 'resumes_in' => $prayerStatus['resumes_in']];
        }
        return ['available' => true];
    }

    private function getDefaultTimes(): array
    {
        return ['fajr' => '05:30', 'sunrise' => '07:00', 'dhuhr' => '13:00', 'asr' => '16:30', 'maghrib' => '19:30', 'isha' => '21:00'];
    }
}
