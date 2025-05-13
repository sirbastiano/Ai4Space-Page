const { createApp } = Vue

createApp({
  data() {
    return {
      workshopOverview: 'Welcome to AI4Space @ NeurIPS! This workshop brings together researchers and practitioners to explore the frontiers of artificial intelligence in space applications. From autonomous exploration to deciphering cosmic data, join us to discuss breakthroughs, challenges, and the future trajectory of AI in the final frontier.',
      tracks: [],
      challenges: [],
      contact: {
        name: '',
        email: '',
        message: ''
      }
    }
  },
  methods: {
    async fetchAi4SpaceContent() {
      try {
        const response = await fetch('/api/ai4space-content'); // Updated API endpoint
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const content = await response.json();
        this.tracks = content.filter(item => item.type === 'Track');
        this.challenges = content.filter(item => item.type === 'Challenge');
      } catch (error) {
        console.error("Could not fetch AI4Space content:", error);
        this.tracks = [];
        this.challenges = [];
      }
    },
    submitForm() {
      alert(`Thank you, ${this.contact.name}! Your message has been received.`);
      this.contact.name = '';
      this.contact.email = '';
      this.contact.message = '';
    }
  },
  mounted() {
    this.fetchAi4SpaceContent(); // Call the renamed fetch method
  }
}).mount('#app')
