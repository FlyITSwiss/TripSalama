<?php

declare(strict_types=1);

/**
 * TripSalama - English Translations
 */

return [
    // Application
    'app' => [
        'name' => 'TripSalama',
        'tagline' => 'Travel with peace of mind',
        'loading' => 'Loading...',
    ],

    // Navigation
    'nav' => [
        'skip_to_content' => 'Skip to content',
        'home' => 'Home',
        'book' => 'Book a ride',
        'history' => 'History',
        'profile' => 'Profile',
        'logout' => 'Log out',
        'dashboard' => 'Dashboard',
    ],

    // Authentication
    'auth' => [
        'login' => 'Login',
        'register' => 'Sign up',
        'logout' => 'Log out',
        'email' => 'Email address',
        'password' => 'Password',
        'password_confirm' => 'Confirm password',
        'remember_me' => 'Remember me',
        'forgot_password' => 'Forgot password?',
        'login_button' => 'Sign in',
        'register_button' => 'Create my account',
        'no_account' => 'Don\'t have an account?',
        'have_account' => 'Already have an account?',
        'register_as' => 'Sign up as',
        'passenger' => 'Passenger',
        'driver' => 'Driver',
        'register_passenger' => 'I\'m a passenger',
        'register_driver' => 'I\'m a driver',
        'welcome_back' => 'Welcome back!',
        'create_account' => 'Create your account',
    ],

    // Forms
    'form' => [
        'first_name' => 'First name',
        'last_name' => 'Last name',
        'phone' => 'Phone',
        'save' => 'Save',
        'cancel' => 'Cancel',
        'submit' => 'Submit',
        'back' => 'Back',
        'next' => 'Next',
        'required' => 'This field is required',
    ],

    // Vehicle
    'vehicle' => [
        'title' => 'My vehicle',
        'brand' => 'Brand',
        'model' => 'Model',
        'color' => 'Color',
        'license_plate' => 'License plate',
        'year' => 'Year',
    ],

    // Booking
    'booking' => [
        'title' => 'Book a ride',
        'pickup' => 'Pickup location',
        'dropoff' => 'Destination',
        'pickup_placeholder' => 'Search for an address...',
        'dropoff_placeholder' => 'Where are you going?',
        'estimate' => 'Estimate trip',
        'confirm_ride' => 'Confirm ride',
        'price' => 'Estimated price',
        'duration' => 'Estimated duration',
        'distance' => 'Distance',
        'my_location' => 'My current location',
        'no_results' => 'No results found',
        'detecting_location' => 'Detecting your location...',
        'location_found' => 'Location detected',
        'change_location' => 'Change pickup location',
        'use_current_location' => 'Use my current location',
        'position_accuracy' => 'Accuracy: :meters m',
    ],

    // Ride
    'ride' => [
        'title' => 'My ride',
        'status' => 'Status',
        'pending' => 'Pending',
        'searching' => 'Searching for a driver...',
        'accepted' => 'Accepted',
        'driver_arriving' => 'Driver on the way',
        'in_progress' => 'Ride in progress',
        'completed' => 'Completed',
        'cancelled' => 'Cancelled',
        'eta' => 'Estimated arrival',
        'cancel' => 'Cancel ride',
        'cancel_confirm' => 'Are you sure you want to cancel this ride?',
        'rate' => 'Rate your ride',
        'rate_driver' => 'Rate your driver',
        'rate_passenger' => 'Rate your passenger',
        'comment' => 'Comment (optional)',
        'submit_rating' => 'Submit rating',
    ],

    // Driver
    'driver' => [
        'title' => 'Driver dashboard',
        'available' => 'Available',
        'unavailable' => 'Unavailable',
        'toggle_status' => 'Toggle my status',
        'pending_rides' => 'Pending rides',
        'no_pending' => 'No pending rides',
        'accept' => 'Accept',
        'reject' => 'Decline',
        'start_ride' => 'Start ride',
        'complete_ride' => 'Complete ride',
        'go_to_passenger' => 'Go to passenger',
        'go_to_destination' => 'Go to destination',
        'arrived_pickup' => 'I\'ve arrived',
    ],

    // History
    'history' => [
        'title' => 'Ride history',
        'no_rides' => 'No rides yet',
        'view_details' => 'View details',
        'total_rides' => 'Total rides',
        'this_month' => 'This month',
    ],

    // Profile
    'profile' => [
        'title' => 'My profile',
        'edit' => 'Edit my profile',
        'edit_description' => 'Update your personal information',
        'personal_info' => 'Personal information',
        'email_readonly' => 'Email address cannot be changed',
        'avatar' => 'Profile picture',
        'change_avatar' => 'Change photo',
        'member_since' => 'Member since',
        'verified' => 'Verified',
        'not_verified' => 'Pending verification',
        'total_rides' => 'Rides completed',
        'rating' => 'Average rating',
    ],

    // Messages
    'msg' => [
        'success' => 'Success',
        'error' => 'Error',
        'warning' => 'Warning',
        'info' => 'Information',
        'saved' => 'Saved successfully',
        'deleted' => 'Deleted successfully',
        'updated' => 'Updated successfully',
        'login_success' => 'Login successful',
        'login_failed' => 'Invalid email or password',
        'logout_success' => 'Logged out successfully',
        'register_success' => 'Account created successfully',
        'ride_created' => 'Ride request sent',
        'ride_booked' => 'Ride booked successfully!',
        'ride_accepted' => 'Ride accepted by a driver',
        'ride_cancelled' => 'Ride cancelled',
        'ride_completed' => 'Ride completed',
        'rating_submitted' => 'Thank you for your rating',
        'position_updated' => 'Position updated',
        'status_changed' => 'Status updated',
    ],

    // Errors
    'error' => [
        'generic' => 'An error occurred',
        'not_found' => 'Page not found',
        'unauthorized' => 'Unauthorized access',
        'forbidden' => 'Access denied',
        'validation' => 'Validation error',
        'csrf' => 'Session expired, please refresh the page',
        'network' => 'Network error, please try again',
        'geolocation' => 'Unable to get your location',
        'geolocation_permission' => 'Please allow access to your location',
        'geolocation_unavailable' => 'Location service unavailable',
        'geolocation_timeout' => 'Location request timed out',
        'geolocation_unsupported' => 'Your browser does not support geolocation',
        'no_driver' => 'No driver available at the moment',
    ],

    // Validation
    'validation' => [
        'email_invalid' => 'Invalid email address',
        'email_taken' => 'This email address is already in use',
        'password_min_length' => 'Password must be at least 8 characters',
        'password_uppercase' => 'Password must contain at least one uppercase letter',
        'password_number' => 'Password must contain at least one number',
        'password_mismatch' => 'Passwords do not match',
        'phone_invalid' => 'Invalid phone number',
        'required_field' => 'This field is required',
        'invalid_file_type' => 'File type not allowed',
        'file_too_large' => 'File too large',
    ],

    // Map
    'map' => [
        'my_position' => 'My position',
        'driver_position' => 'Driver position',
        'pickup_point' => 'Pickup point',
        'dropoff_point' => 'Drop-off point',
        'loading_map' => 'Loading map...',
    ],

    // Simulation
    'simulation' => [
        'demo_mode' => 'Demo mode',
        'speed' => 'Speed',
        'normal' => 'Normal',
        'fast' => 'Fast',
        'very_fast' => 'Very fast',
    ],

    // Tracking
    'tracking' => [
        'center_vehicle' => 'Center on vehicle',
        'minutes' => 'minutes',
        'remaining' => 'remaining',
        'call' => 'Call',
        'arrived' => 'You have arrived!',
        'finish' => 'Finish',
        'trip_complete' => 'Trip completed in {duration} minutes',
    ],

    // Geolocation
    'geolocation' => [
        'unsupported' => 'Geolocation not supported',
        'permission_denied' => 'Location access denied',
        'unavailable' => 'Location unavailable',
        'timeout' => 'Location timeout',
        'error' => 'Geolocation error',
        'detecting' => 'Detecting your location...',
        'detected' => 'Location detected',
        'accuracy' => 'Accuracy: {meters} m',
        'use_current' => 'Use my current location',
    ],

    // Demo mode
    'demo' => [
        'title' => 'Real-time tracking demo',
        'loading_map' => 'Loading map...',
        'arrival' => 'Arrival',
        'distance' => 'Distance',
        'speed' => 'Speed',
        'start_demo' => 'Start demo',
        'hint' => 'Click to see a vehicle moving towards you',
        'pause' => 'Pause',
        'resume' => 'Resume',
        'stop' => 'Stop',
        'center_map' => 'Center map',
        'call_driver' => 'Call driver',
        'driver_arrived' => 'Your driver has arrived!',
        'driver_waiting' => 'She\'s waiting for you outside.',
        'restart' => 'Restart demo',
        'locating' => 'Locating...',
        'locating_you' => 'Detecting your location...',
        'position_found' => 'Location found!',
        'is_coming' => 'is coming to you',
        'paused' => 'Simulation paused',
        'arrived_notification' => 'Your driver has arrived!',
        'call_demo_only' => 'Call not available in demo mode',
        'error_occurred' => 'An error occurred',
        'your_position' => 'You are here',
        'geo_unsupported' => 'Geolocation not supported',
        'initializing' => 'Initializing...',
        'ride_confirmed' => 'Ride confirmed',
        'driver_approaching' => 'Driver approaching',
        'boarding' => 'Boarding...',
        'boarding_message' => 'Your driver is waiting outside. Get in!',
        'seconds' => 'seconds',
        'trip_in_progress' => 'Trip in progress',
        'arriving_destination' => 'Arriving soon',
        'trip_completed' => 'Trip completed!',
        'trip_summary' => 'Trip completed in :duration minutes',
        'rate_driver' => 'Rate your driver',
        'rate_subtitle' => 'How was your trip?',
        'tap_to_rate' => 'Tap to rate',
        'rating_1' => 'Very poor',
        'rating_2' => 'Poor',
        'rating_3' => 'Average',
        'rating_4' => 'Good',
        'rating_5' => 'Excellent!',
        'add_tip' => 'Add a tip',
        'no_tip' => 'No thanks',
        'thank_you' => 'Thank you!',
        'thank_you_message' => 'Your rating has been submitted. See you soon on TripSalama!',
        'back_home' => 'Back to home',
    ],

    // Identity verification
    'verification' => [
        'title' => 'Identity Verification',
        'subtitle' => 'For your safety, we verify that you are a woman',
        'camera_permission' => 'Allow camera access',
        'camera_denied' => 'Camera access denied',
        'camera_not_found' => 'No camera detected',
        'take_photo' => 'Take a photo',
        'retake' => 'Retake',
        'submit' => 'Validate my photo',
        'processing' => 'Analyzing...',
        'success' => 'Verification successful!',
        'success_message' => 'Welcome to the TripSalama community',
        'failed' => 'Verification failed',
        'failed_message' => 'We could not automatically verify your identity',
        'pending_review' => 'Pending verification',
        'pending_message' => 'Our team will review your request within 24 hours',
        'tips_title' => 'Tips for a good photo',
        'tip_face_visible' => 'Face clearly visible and centered',
        'tip_good_lighting' => 'Good lighting, avoid backlight',
        'tip_no_sunglasses' => 'Remove sunglasses and hat',
        'tip_neutral_expression' => 'Neutral or smiling expression',
        'privacy_notice' => 'Your photo is analyzed locally and is not sent to third-party servers.',
        'consent_text' => 'I agree that my photo will be used to verify my identity',
        'consent_required' => 'You must accept to continue',
        'manual_review_info' => 'Our team will review your request within 24 hours',
        'skip_for_now' => 'Skip for now',
        'continue' => 'Continue',
    ],

    // Footer
    'footer' => [
        'copyright' => '© 2025 TripSalama. All rights reserved.',
        'privacy' => 'Privacy',
        'terms' => 'Terms of service',
        'contact' => 'Contact',
    ],
];
