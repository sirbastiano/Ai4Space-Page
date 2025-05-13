const ChallengeDetailApp = {
    data() {
        return {
            challenge: null,
            loading: true,
            loadingError: false,
            challengeId: ''
        };
    },
    created() {
        this.fetchChallengeDetails();
    },
    methods: {
        getChallengeIdFromPath() {
            const pathSegments = window.location.pathname.split('/');
            // Assuming URL is /challenge/challengeId
            if (pathSegments.length >= 3 && pathSegments[pathSegments.length - 2] === 'challenge') {
                return pathSegments[pathSegments.length - 1];
            }
            return null;
        },
        async fetchChallengeDetails() {
            this.challengeId = this.getChallengeIdFromPath();
            if (!this.challengeId) {
                console.error('Challenge ID not found in URL path.');
                this.loading = false;
                this.loadingError = true;
                return;
            }

            this.loading = true;
            this.loadingError = false;
            try {
                const response = await fetch(`/api/challenges/${this.challengeId}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                if (data.error) {
                    console.error('Error fetching challenge details:', data.error);
                    this.loadingError = true;
                    this.challenge = null;
                } else {
                    this.challenge = data;
                    document.title = `${this.challenge.title || 'Challenge Details'} - AI4Space @ NeurIPS`;
                }
            } catch (error) {
                console.error('Failed to fetch challenge details:', error);
                this.loadingError = true;
                this.challenge = null;
            } finally {
                this.loading = false;
            }
        }
    }
};

Vue.createApp(ChallengeDetailApp).mount('#challenge-detail-app');
