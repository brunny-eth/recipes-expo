import React from 'react';
import { render, fireEvent } from '../utils/testUtils';
import ServingScaler from '../../components/recipe/ServingScaler';

describe('ServingScaler', () => {
  const defaultProps = {
    selectedScaleFactor: 1.0,
    handleScaleFactorChange: jest.fn(),
    recipeYield: '4 servings',
    originalYieldValue: 4,
    isViewingSavedRecipe: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with default props', () => {
    const { getByText } = render(<ServingScaler {...defaultProps} />);
    
    expect(getByText('This recipe makes 4 servings. Scale it up or down here.')).toBeTruthy();
    expect(getByText('Half')).toBeTruthy();
    expect(getByText('Original')).toBeTruthy();
    expect(getByText('1.5x')).toBeTruthy();
    expect(getByText('2x')).toBeTruthy();
    expect(getByText('4x')).toBeTruthy();
  });

  it('displays scaled yield text when scale factor is not 1', () => {
    const { getByText } = render(
      <ServingScaler 
        {...defaultProps} 
        selectedScaleFactor={2.0} 
      />
    );
    
    expect(getByText('Now scaled up to 8 servings.')).toBeTruthy();
  });

  it('displays scaled down text when scale factor is less than 1', () => {
    const { getByText } = render(
      <ServingScaler 
        {...defaultProps} 
        selectedScaleFactor={0.5} 
      />
    );
    
    expect(getByText('Now scaled down to 2 servings.')).toBeTruthy();
  });

  it('handles recipes without specified servings', () => {
    const { getByText } = render(
      <ServingScaler 
        {...defaultProps} 
        recipeYield={null}
        originalYieldValue={null}
      />
    );
    
    expect(getByText("This recipe doesn't specify servings amount, but we can still scale amounts up or down if you'd like.")).toBeTruthy();
  });

  it('handles scaling when no original yield value is available', () => {
    const { getByText } = render(
      <ServingScaler 
        {...defaultProps} 
        recipeYield={null}
        originalYieldValue={null}
        selectedScaleFactor={2.0}
      />
    );
    
    expect(getByText('Now scaled up by 2x.')).toBeTruthy();
  });

  it('calls handleScaleFactorChange when scale button is pressed', () => {
    const mockHandleScaleFactorChange = jest.fn();
    const { getByText } = render(
      <ServingScaler 
        {...defaultProps} 
        handleScaleFactorChange={mockHandleScaleFactorChange}
      />
    );
    
    fireEvent.press(getByText('2x'));
    expect(mockHandleScaleFactorChange).toHaveBeenCalledWith(2.0);
  });

  it('highlights the selected scale factor button', () => {
    const { getByText } = render(
      <ServingScaler 
        {...defaultProps} 
        selectedScaleFactor={2.0}
      />
    );
    
    const button = getByText('2x').parent;
    expect(button).toHaveStyle({ backgroundColor: expect.any(String) });
  });

  it('works with saved recipes', () => {
    const { getByText } = render(
      <ServingScaler 
        {...defaultProps} 
        isViewingSavedRecipe={true}
        selectedScaleFactor={2.0}
      />
    );
    
    // For saved recipes, should use the recipeYield as-is
    expect(getByText('Now scaled up to 4 servings.')).toBeTruthy();
  });

  describe('different recipe yield formats', () => {
    it('handles recipe yield with units', () => {
      const { getByText } = render(
        <ServingScaler 
          {...defaultProps} 
          recipeYield="6 burgers"
          originalYieldValue={6}
          selectedScaleFactor={2.0}
        />
      );
      
      expect(getByText('Now scaled up to 12 burgers.')).toBeTruthy();
    });

    it('handles recipe yield ranges', () => {
      const { getByText } = render(
        <ServingScaler 
          {...defaultProps} 
          recipeYield="4-6 servings"
          originalYieldValue={5}
          selectedScaleFactor={2.0}
        />
      );
      
      expect(getByText('Now scaled up to 10 servings.')).toBeTruthy();
    });

    it('handles complex recipe yield strings', () => {
      const { getByText } = render(
        <ServingScaler 
          {...defaultProps} 
          recipeYield="Makes about 8 portions"
          originalYieldValue={8}
          selectedScaleFactor={0.5}
        />
      );
      
      expect(getByText('Now scaled down to 4 portions.')).toBeTruthy();
    });
  });

  describe('scale factor options', () => {
    it('renders all scale factor options', () => {
      const { getByText } = render(<ServingScaler {...defaultProps} />);
      
      expect(getByText('Half')).toBeTruthy();
      expect(getByText('Original')).toBeTruthy();
      expect(getByText('1.5x')).toBeTruthy();
      expect(getByText('2x')).toBeTruthy();
      expect(getByText('4x')).toBeTruthy();
    });

    it('can select half scale factor', () => {
      const mockHandleScaleFactorChange = jest.fn();
      const { getByText } = render(
        <ServingScaler 
          {...defaultProps} 
          handleScaleFactorChange={mockHandleScaleFactorChange}
        />
      );
      
      fireEvent.press(getByText('Half'));
      expect(mockHandleScaleFactorChange).toHaveBeenCalledWith(0.5);
    });

    it('can select 1.5x scale factor', () => {
      const mockHandleScaleFactorChange = jest.fn();
      const { getByText } = render(
        <ServingScaler 
          {...defaultProps} 
          handleScaleFactorChange={mockHandleScaleFactorChange}
        />
      );
      
      fireEvent.press(getByText('1.5x'));
      expect(mockHandleScaleFactorChange).toHaveBeenCalledWith(1.5);
    });

    it('can select 4x scale factor', () => {
      const mockHandleScaleFactorChange = jest.fn();
      const { getByText } = render(
        <ServingScaler 
          {...defaultProps} 
          handleScaleFactorChange={mockHandleScaleFactorChange}
        />
      );
      
      fireEvent.press(getByText('4x'));
      expect(mockHandleScaleFactorChange).toHaveBeenCalledWith(4.0);
    });

    it('can return to original scale factor', () => {
      const mockHandleScaleFactorChange = jest.fn();
      const { getByText } = render(
        <ServingScaler 
          {...defaultProps} 
          selectedScaleFactor={2.0}
          handleScaleFactorChange={mockHandleScaleFactorChange}
        />
      );
      
      fireEvent.press(getByText('Original'));
      expect(mockHandleScaleFactorChange).toHaveBeenCalledWith(1.0);
    });
  });

  describe('edge cases', () => {
    it('handles undefined recipe yield', () => {
      const { getByText } = render(
        <ServingScaler 
          {...defaultProps} 
          recipeYield={undefined}
          originalYieldValue={null}
        />
      );
      
      expect(getByText("This recipe doesn't specify servings amount, but we can still scale amounts up or down if you'd like.")).toBeTruthy();
    });

    it('handles empty recipe yield', () => {
      const { getByText } = render(
        <ServingScaler 
          {...defaultProps} 
          recipeYield=""
          originalYieldValue={null}
        />
      );
      
      expect(getByText("This recipe doesn't specify servings amount, but we can still scale amounts up or down if you'd like.")).toBeTruthy();
    });

    it('handles zero original yield value', () => {
      const { getByText } = render(
        <ServingScaler 
          {...defaultProps} 
          originalYieldValue={0}
          selectedScaleFactor={2.0}
        />
      );
      
      expect(getByText('Now scaled up by 2x.')).toBeTruthy();
    });

    it('handles negative original yield value', () => {
      const { getByText } = render(
        <ServingScaler 
          {...defaultProps} 
          originalYieldValue={-1}
          selectedScaleFactor={2.0}
        />
      );
      
      expect(getByText('Now scaled up by 2x.')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('scale factor buttons are pressable', () => {
      const mockHandleScaleFactorChange = jest.fn();
      const { getByText } = render(
        <ServingScaler 
          {...defaultProps} 
          handleScaleFactorChange={mockHandleScaleFactorChange}
        />
      );
      
      const buttons = ['Half', 'Original', '1.5x', '2x', '4x'];
      buttons.forEach(buttonText => {
        const button = getByText(buttonText);
        expect(button).toBeTruthy();
        fireEvent.press(button);
      });
      
      expect(mockHandleScaleFactorChange).toHaveBeenCalledTimes(5);
    });
  });
}); 