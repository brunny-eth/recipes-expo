document.addEventListener('DOMContentLoaded', function () {
    const linkToHomeLogo = document.getElementById('link-to-home-logo');
    const tabWhatIsThis = document.getElementById('tab-whatisthis');
    const linkToHome = document.getElementById('link-to-home'); // Link from 'What is this?' back to Home

    const contentHome = document.getElementById('content-home');
    const contentWhatIsThis = document.getElementById('content-whatisthis');

    const recipeForm = document.getElementById('recipe-form');
    const recipeUrlInput = document.getElementById('recipe-url');
    const qrCodeContainer = document.getElementById('qr-code-container');
    const qrCodeImg = document.getElementById('qr-code-img');
    const qrDataMock = document.getElementById('qr-data-mock');
    const loadingStepsContainer = document.getElementById('loading-steps');

    function showTab(tabName) {
        // Hide all content
        contentHome.classList.remove('active');
        contentWhatIsThis.classList.remove('active');

        // Deactivate all tabs
        // No active state for logo, so we only manage the 'whatisthis' tab
        tabWhatIsThis.classList.remove('active');

        // Activate selected tab and content
        if (tabName === 'home') {
            contentHome.classList.add('active');
        } else if (tabName === 'whatisthis') {
            contentWhatIsThis.classList.add('active');
            tabWhatIsThis.classList.add('active');
        }
        // Scroll to top when tab changes for better UX on mobile
        window.scrollTo(0, 0);
    }

    if (linkToHomeLogo) {
        linkToHomeLogo.addEventListener('click', function (event) {
            event.preventDefault();
            showTab('home');
        });
    }

    tabWhatIsThis.addEventListener('click', function (event) {
        event.preventDefault();
        showTab('whatisthis');
    });
    
    // Listener for the link within 'What is this?' page to go back to home tab
    if(linkToHome){
        linkToHome.addEventListener('click', function(event){
            event.preventDefault();
            showTab('home');
        });
    }

    recipeForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        const url = recipeUrlInput.value.trim();
        if (!url) {
            alert('Please paste a recipe URL.');
            return;
        }

        // --- UI transition to loading state ---
        recipeForm.style.display = 'none';
        qrCodeContainer.style.display = 'none';
        loadingStepsContainer.innerHTML = ''; // Clear previous steps
        loadingStepsContainer.style.display = 'block';
        loadingStepsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const steps = [
            { label: 'Skipping the slop', subtext: 'Sifting through 3,000 words of fluff' },
            { label: 'Deleting the ads', subtext: 'Why are there so many of them?' },
            { label: 'Finding backup ingredients', subtext: "Just in case you don't have cardamom" },
            { label: 'Throwing out all the junk', subtext: 'Cleaning up unnecessary extras' },
            { label: 'Doing the servings math', subtext: 'Scaling things up or down for you' },
        ];

        // --- Start API call (mocked) and animation concurrently ---

        // 1. Mock API Call Promise
        const apiCallPromise = new Promise(resolve => {
            // In a real app, this would be a fetch call to '/api/recipes/parse'
            // For this mock, we simulate a network request that takes some time.
            setTimeout(() => {
                const mockRecipeId = `mock_recipe_${Date.now()}`;
                resolve(mockRecipeId);
            }, 4000); // Mocked 4-second API call
        });

        // 2. Animation Promise
        const animationPromise = new Promise(resolve => {
            let stepIndex = 0;
            const stepInterval = 2000;

            const showNextStep = () => {
                if (stepIndex < steps.length) {
                    const step = steps[stepIndex];
                    const stepElement = document.createElement('div');
                    stepElement.classList.add('step-item');
                    stepElement.innerHTML = `
                        <div class="step-check"></div>
                        <div class="step-text">
                            <div class="label">${step.label}</div>
                            <div class="subtext">${step.subtext}</div>
                        </div>
                    `;
                    loadingStepsContainer.appendChild(stepElement);

                    // Animate checkmark after a short delay
                    setTimeout(() => {
                        stepElement.querySelector('.step-check').classList.add('done');
                    }, 200);

                    stepIndex++;
                    setTimeout(showNextStep, stepInterval); // Schedule next step
                } else {
                    resolve(); // All steps shown, resolve promise
                }
            };
            
            showNextStep(); // Start the animation chain
        });

        // --- Wait for both to complete ---
        const [recipeId] = await Promise.all([apiCallPromise, animationPromise]);
        
        // --- UI transition to final state ---
        const appUrl = `meezapp://recipe?id=${recipeId}`;
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(appUrl)}`;
        
        qrCodeImg.src = qrApiUrl;
        qrCodeImg.alt = `QR Code for your recipe`;
        qrDataMock.textContent = `(Mock QR: would link to Meez app with recipe ID: ${recipeId})`;

        loadingStepsContainer.style.display = 'none';
        qrCodeContainer.style.display = 'block';
        qrCodeContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    // Initialize with the home tab active
    showTab('home');
}); 