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
        'pickup_placeholder' => 'Where would you like to be picked up?',
        'dropoff_placeholder' => 'Where are you going?',
        'estimate' => 'Estimate trip',
        'confirm_ride' => 'Confirm ride',
        'price' => 'Estimated price',
        'duration' => 'Estimated duration',
        'distance' => 'Distance',
        'my_location' => 'My current location',
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

    // Footer
    'footer' => [
        'copyright' => '© 2025 TripSalama. All rights reserved.',
        'privacy' => 'Privacy',
        'terms' => 'Terms of service',
        'contact' => 'Contact',
    ],
];
