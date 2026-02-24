<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;

class InsuranceService
{
    private PDO $db;
    private ?string $provider;
    private ?string $policyNumber;
    private ?string $certificateUrl;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->provider = $_ENV["INSURANCE_PROVIDER"] ?? null;
        $this->policyNumber = $_ENV["INSURANCE_POLICY_NUMBER"] ?? null;
        $this->certificateUrl = $_ENV["INSURANCE_CERTIFICATE_URL"] ?? null;
    }

    public function isConfigured(): bool
    {
        return !empty($this->provider) && !empty($this->policyNumber);
    }

    public function getInsuranceInfo(): array
    {
        return [
            "configured" => $this->isConfigured(),
            "provider" => $this->provider,
            "policy_number" => $this->policyNumber,
            "certificate_url" => $this->certificateUrl,
            "coverage" => $this->getCoverageDetails(),
        ];
    }

    public function getCoverageDetails(): array
    {
        return [
            "passenger_liability" => ["amount" => "1,000,000 MAD", "description" => "Responsabilite civile passagere"],
            "driver_liability" => ["amount" => "2,000,000 MAD", "description" => "Responsabilite civile conductrice"],
            "medical_expenses" => ["amount" => "100,000 MAD", "description" => "Frais medicaux"],
            "vehicle_damage" => ["amount" => "500,000 MAD", "description" => "Dommages vehicule"],
            "luggage" => ["amount" => "10,000 MAD", "description" => "Bagages"],
        ];
    }

    public function getLegalMentions(): array
    {
        return [
            "company_name" => "TripSalama SARL",
            "legal_form" => "Societe a Responsabilite Limitee",
            "registration" => "RC Casablanca",
            "capital" => "100,000 MAD",
            "headquarters" => "Casablanca, Maroc",
            "jurisdiction" => "Tribunaux de Casablanca",
            "contact" => ["email" => "contact@tripsalama.com", "phone" => "+212 XXX XXXXXX"],
            "hosting" => ["provider" => "Infomaniak", "location" => "Suisse"],
        ];
    }

    public function getTermsOfService(): array
    {
        return [
            "version" => "2025.1",
            "effective_date" => "2025-01-01",
            "last_updated" => date("Y-m-d"),
            "sections" => [
                ["id" => "acceptance", "title" => "Acceptation", "content" => "En utilisant TripSalama, vous acceptez ces CGU."],
                ["id" => "service", "title" => "Service", "content" => "Mise en relation passageres-conductrices, reserve aux femmes."],
                ["id" => "eligibility", "title" => "Eligibilite", "content" => "Service reserve aux femmes majeures (18+)."],
                ["id" => "pricing", "title" => "Tarification", "content" => "Prix calcule selon distance et duree."],
                ["id" => "payment", "title" => "Paiement", "content" => "Carte, wallet ou especes acceptes."],
                ["id" => "insurance", "title" => "Assurance", "content" => "Toutes les courses sont assurees."],
                ["id" => "prayer", "title" => "Horaires de priere", "content" => "Pause auto possible pendant les prieres."],
            ],
        ];
    }

    public function getPrivacyPolicy(): array
    {
        return [
            "version" => "2025.1",
            "data_controller" => ["name" => "TripSalama SARL", "email" => "privacy@tripsalama.com"],
            "sections" => [
                ["id" => "data", "title" => "Donnees collectees", "content" => "Nom, email, telephone, photo, GPS, paiements."],
                ["id" => "purpose", "title" => "Finalites", "content" => "Service de transport, securite, paiements."],
                ["id" => "retention", "title" => "Conservation", "content" => "5 ans apres derniere activite. GPS: 90 jours."],
                ["id" => "rights", "title" => "Vos droits", "content" => "Acces, rectification, suppression, portabilite."],
            ],
        ];
    }

    public function hasAcceptedTerms(int $userId): bool
    {
        $stmt = $this->db->prepare("SELECT terms_accepted_at FROM users WHERE id = :id AND terms_accepted_at IS NOT NULL");
        $stmt->execute(["id" => $userId]);
        return (bool) $stmt->fetch();
    }

    public function acceptTerms(int $userId, string $version): bool
    {
        $stmt = $this->db->prepare("UPDATE users SET terms_accepted_at = NOW(), terms_version = :version WHERE id = :id");
        return $stmt->execute(["id" => $userId, "version" => $version]);
    }

    public function generateRideCertificate(int $rideId): array
    {
        $stmt = $this->db->prepare("SELECT r.*, p.first_name as passenger_name, d.first_name as driver_name, v.license_plate FROM rides r JOIN users p ON r.passenger_id = p.id JOIN users d ON r.driver_id = d.id LEFT JOIN vehicles v ON r.vehicle_id = v.id WHERE r.id = :id");
        $stmt->execute(["id" => $rideId]);
        $ride = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$ride) {
            return ["error" => "Course non trouvee"];
        }
        return [
            "certificate_number" => "TS-" . date("Y") . "-" . str_pad((string) $rideId, 8, "0", STR_PAD_LEFT),
            "insurance_provider" => $this->provider,
            "policy_number" => $this->policyNumber,
            "ride_id" => $rideId,
            "date" => $ride["created_at"],
            "passenger" => $ride["passenger_name"],
            "driver" => $ride["driver_name"],
            "vehicle" => $ride["license_plate"],
            "coverage" => $this->getCoverageDetails(),
            "valid_until" => date("Y-m-d", strtotime("+30 days")),
        ];
    }
}
