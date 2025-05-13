const TrackDetailApp = {
    data() {
        return {
            track: null,
            loading: true,
            loadingError: false,
            trackId: ''
        };
    },
    created() {
        this.fetchTrackDetails();
    },
    methods: {
        getTrackIdFromPath() {
            const pathSegments = window.location.pathname.split('/');
            // Assuming URL is /track/trackId
            if (pathSegments.length >= 3 && pathSegments[pathSegments.length - 2] === 'track') {
                return pathSegments[pathSegments.length - 1];
            }
            return null;
        },
        async fetchTrackDetails() {
            this.trackId = this.getTrackIdFromPath();
            if (!this.trackId) {
                console.error('Track ID not found in URL path.');
                this.loading = false;
                this.loadingError = true;
                return;
            }

            this.loading = true;
            this.loadingError = false;
            try {
                const response = await fetch(`/api/tracks/${this.trackId}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                if (data.error) {
                    console.error('Error fetching track details:', data.error);
                    this.loadingError = true;
                    this.track = null;
                } else {
                    this.track = data;
                    document.title = `${this.track.title || 'Track Details'} - AI4Space @ NeurIPS`;
                }
            } catch (error) {
                console.error('Failed to fetch track details:', error);
                this.loadingError = true;
                this.track = null;
            } finally {
                this.loading = false;
            }
        }
    }
};

Vue.createApp(TrackDetailApp).mount('#track-detail-app');
