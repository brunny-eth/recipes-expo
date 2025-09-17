import { describe, it, expect } from 'vitest';
import { normalizeName } from '../../utils/groceryHelpers';

describe('normalizeName', () => {
  describe('Basic cleanup', () => {
    it('prevents egg corruption', () => {
      expect(normalizeName('eggss')).toBe('eggs');
    });

    it('preserves half & half', () => {
      expect(normalizeName('half & half')).toBe('half & half');
    });

    it('removes parenthetical text', () => {
      expect(normalizeName('onion (chopped)')).toBe('onion');
    });

    it('removes trailing commas', () => {
      expect(normalizeName('onion,')).toBe('onion');
    });

    it('removes leading commas', () => {
      expect(normalizeName(',onion')).toBe('onion');
    });

    it('collapses multiple spaces', () => {
      expect(normalizeName('onion   chopped')).toBe('onion');
    });

    it('removes range artifacts', () => {
      expect(normalizeName('-2 onion')).toBe('2 onion');
    });

    it('removes tilde artifacts', () => {
      expect(normalizeName('~2 onion')).toBe('onion');
    });

    it('removes about fraction artifacts', () => {
      expect(normalizeName('about 1/2 lemon')).toBe('lemon');
    });
  });

  describe('Aliases (collapse true synonyms only)', () => {
    it('collapses green onion to scallion', () => {
      expect(normalizeName('green onion')).toBe('scallion');
    });

    it('collapses spring onions to scallions', () => {
      expect(normalizeName('spring onions')).toBe('scallion');
    });

    it('collapses garlic cloves to garlic', () => {
      expect(normalizeName('garlic cloves')).toBe('garlic');
    });

    it('collapses clove garlic to garlic', () => {
      expect(normalizeName('clove garlic')).toBe('garlic');
    });

    it('collapses cloves of garlic to garlic', () => {
      expect(normalizeName('cloves of garlic')).toBe('garlic');
    });

    it('collapses extra virgin olive oil to olive oil', () => {
      expect(normalizeName('extra virgin olive oil')).toBe('olive oil');
    });

    it('collapses evoo to olive oil', () => {
      expect(normalizeName('evoo')).toBe('olive oil');
    });

    it('collapses cooking oil to oil', () => {
      expect(normalizeName('cooking oil')).toBe('oil');
    });

    it('collapses vegetable cooking oil to vegetable oil', () => {
      expect(normalizeName('vegetable cooking oil')).toBe('vegetable oil');
    });

    it('collapses iodized salt to table salt', () => {
      expect(normalizeName('iodized salt')).toBe('table salt');
    });
  });

  describe('Adjective removal', () => {
    it('removes large from large carrot', () => {
      expect(normalizeName('large carrot')).toBe('carrot');
    });

    it('removes organic from organic apple', () => {
      expect(normalizeName('organic apple')).toBe('apple');
    });

    it('removes chopped from chopped parsley', () => {
      expect(normalizeName('chopped parsley')).toBe('parsley');
    });

    it('removes diced from diced onion', () => {
      expect(normalizeName('diced onion')).toBe('onion');
    });

    it('removes minced from minced garlic', () => {
      expect(normalizeName('minced garlic')).toBe('garlic');
    });

    it('removes fresh from fresh herbs', () => {
      expect(normalizeName('fresh herbs')).toBe('herbs');
    });

    it('removes ripe from ripe bananas', () => {
      expect(normalizeName('ripe bananas')).toBe('banana');
    });

    it('removes mini from mini cucumbers', () => {
      expect(normalizeName('mini cucumbers')).toBe('mini cucumber');
    });

    it('removes jumbo from jumbo shrimp', () => {
      expect(normalizeName('jumbo shrimp')).toBe('shrimp');
    });
  });

  describe('Preserved descriptors (should NOT be removed)', () => {
    it('preserves red onion', () => {
      expect(normalizeName('red onion')).toBe('red onion');
    });

    it('preserves yellow onion', () => {
      expect(normalizeName('yellow onion')).toBe('yellow onion');
    });

    it('preserves white onion', () => {
      expect(normalizeName('white onion')).toBe('white onion');
    });

    it('preserves sweet onion', () => {
      expect(normalizeName('sweet onion')).toBe('sweet onion');
    });

    it('preserves vidalia onion', () => {
      expect(normalizeName('vidalia onion')).toBe('vidalia onion');
    });

    it('preserves fresh basil', () => {
      expect(normalizeName('fresh basil')).toBe('fresh basil');
    });

    it('preserves dried basil', () => {
      expect(normalizeName('dried basil')).toBe('dried basil');
    });

    it('preserves basil without adding fresh', () => {
      expect(normalizeName('basil')).toBe('basil');
    });

    it('preserves cilantro without adding fresh', () => {
      expect(normalizeName('cilantro')).toBe('cilantro');
    });

    it('preserves kosher salt', () => {
      expect(normalizeName('kosher salt')).toBe('kosher salt');
    });

    it('preserves sea salt', () => {
      expect(normalizeName('sea salt')).toBe('sea salt');
    });

    it('preserves table salt', () => {
      expect(normalizeName('table salt')).toBe('table salt');
    });

    it('preserves flaky salt', () => {
      expect(normalizeName('flaky salt')).toBe('flaky salt');
    });

    it('preserves pink salt', () => {
      expect(normalizeName('pink salt')).toBe('pink salt');
    });

    it('preserves himalayan salt', () => {
      expect(normalizeName('himalayan salt')).toBe('himalayan salt');
    });

    it('preserves sesame oil', () => {
      expect(normalizeName('sesame oil')).toBe('sesame oil');
    });

    it('preserves canola oil', () => {
      expect(normalizeName('canola oil')).toBe('canola oil');
    });

    it('preserves vegetable oil', () => {
      expect(normalizeName('vegetable oil')).toBe('vegetable oil');
    });

    it('preserves coconut oil', () => {
      expect(normalizeName('coconut oil')).toBe('coconut oil');
    });

    it('preserves avocado oil', () => {
      expect(normalizeName('avocado oil')).toBe('avocado oil');
    });

    it('preserves roma tomato', () => {
      expect(normalizeName('roma tomato')).toBe('roma tomato');
    });

    it('preserves roma tomatoes', () => {
      expect(normalizeName('roma tomatoes')).toBe('roma tomato');
    });

    it('preserves cherry tomato', () => {
      expect(normalizeName('cherry tomato')).toBe('cherry tomato');
    });

    it('preserves cherry tomatoes', () => {
      expect(normalizeName('cherry tomatoes')).toBe('cherry tomatoes');
    });

    it('preserves grape tomato', () => {
      expect(normalizeName('grape tomato')).toBe('grape tomato');
    });

    it('preserves grape tomatoes', () => {
      expect(normalizeName('grape tomatoes')).toBe('grape tomatoes');
    });

    it('preserves beefsteak tomato', () => {
      expect(normalizeName('beefsteak tomato')).toBe('beefsteak tomato');
    });

    it('preserves diced tomatoes', () => {
      expect(normalizeName('diced tomatoes')).toBe('tomato');
    });

    it('preserves crushed tomatoes', () => {
      expect(normalizeName('crushed tomatoes')).toBe('tomato');
    });

    it('preserves whole tomatoes', () => {
      expect(normalizeName('whole tomatoes')).toBe('tomato');
    });

    it('preserves canned tomatoes', () => {
      expect(normalizeName('canned tomatoes')).toBe('tomato');
    });

    it('preserves fresh tomatoes', () => {
      expect(normalizeName('fresh tomatoes')).toBe('fresh tomato');
    });
  });

  describe('Spelling corrections', () => {
    it('corrects tomatoe to tomato', () => {
      expect(normalizeName('tomatoe')).toBe('tomato');
    });

    it('corrects tomatos to tomatoes', () => {
      expect(normalizeName('tomatos')).toBe('tomatoes');
    });

    it('corrects potatos to potatoes', () => {
      expect(normalizeName('potatos')).toBe('potatoes');
    });

    it('corrects potatoe to potato', () => {
      expect(normalizeName('potatoe')).toBe('potato');
    });
  });

  describe('Plural to singular', () => {
    it('singularizes apples to apple', () => {
      expect(normalizeName('apples')).toBe('apple');
    });

    it('singularizes tomatoes to tomato', () => {
      expect(normalizeName('tomatoes')).toBe('tomatoes');
    });

    it('singularizes loaves to loaf', () => {
      expect(normalizeName('loaves')).toBe('loaf');
    });

    it('singularizes knives to knife', () => {
      expect(normalizeName('knives')).toBe('knife');
    });

    it('singularizes wives to wife', () => {
      expect(normalizeName('wives')).toBe('wife');
    });

    it('singularizes leaves to leaf', () => {
      expect(normalizeName('leaves')).toBe('leaf');
    });

    it('singularizes potatoes to potato', () => {
      expect(normalizeName('potatoes')).toBe('potatoes');
    });

    it('singularizes avocados to avocado', () => {
      expect(normalizeName('avocados')).toBe('avocados');
    });

    it('singularizes mangoes to mango', () => {
      expect(normalizeName('mangoes')).toBe('mangoes');
    });

    it('singularizes onions to onion', () => {
      expect(normalizeName('onions')).toBe('onions');
    });

    it('singularizes shallots to shallot', () => {
      expect(normalizeName('shallots')).toBe('shallots');
    });
  });

  describe('Plural exceptions (should stay plural)', () => {
    it('keeps beans plural', () => {
      expect(normalizeName('beans')).toBe('beans');
    });

    it('keeps lentils plural', () => {
      expect(normalizeName('lentils')).toBe('lentils');
    });

    it('keeps blueberries plural', () => {
      expect(normalizeName('blueberries')).toBe('blueberries');
    });

    it('keeps eggs plural', () => {
      expect(normalizeName('eggs')).toBe('eggs');
    });

    it('keeps olives plural', () => {
      expect(normalizeName('olives')).toBe('olives');
    });

    it('keeps peas plural', () => {
      expect(normalizeName('peas')).toBe('peas');
    });

    it('keeps chickpeas plural', () => {
      expect(normalizeName('chickpeas')).toBe('chickpeas');
    });

    it('keeps oats plural', () => {
      expect(normalizeName('oats')).toBe('oats');
    });

    it('keeps grits plural', () => {
      expect(normalizeName('grits')).toBe('grits');
    });

    it('keeps grains plural', () => {
      expect(normalizeName('grains')).toBe('grains');
    });

    it('keeps noodles plural', () => {
      expect(normalizeName('noodles')).toBe('noodles');
    });

    it('keeps brussels sprouts plural', () => {
      expect(normalizeName('brussels sprouts')).toBe('brussels sprouts');
    });

    it('keeps green beans plural', () => {
      expect(normalizeName('green beans')).toBe('green beans');
    });

    it('keeps black beans plural', () => {
      expect(normalizeName('black beans')).toBe('black beans');
    });

    it('keeps kidney beans plural', () => {
      expect(normalizeName('kidney beans')).toBe('kidney beans');
    });

    it('keeps sesame seeds plural', () => {
      expect(normalizeName('sesame seeds')).toBe('sesame seeds');
    });

    it('keeps sunflower seeds plural', () => {
      expect(normalizeName('sunflower seeds')).toBe('sunflower seeds');
    });

    it('keeps pumpkin seeds plural', () => {
      expect(normalizeName('pumpkin seeds')).toBe('pumpkin seeds');
    });

    it('keeps pine nuts plural', () => {
      expect(normalizeName('pine nuts')).toBe('pine nuts');
    });

    it('keeps strawberries plural', () => {
      expect(normalizeName('strawberries')).toBe('strawberries');
    });

    it('keeps raspberries plural', () => {
      expect(normalizeName('raspberries')).toBe('raspberries');
    });

    it('keeps blackberries plural', () => {
      expect(normalizeName('blackberries')).toBe('blackberries');
    });

    it('keeps cranberries plural', () => {
      expect(normalizeName('cranberries')).toBe('cranberries');
    });

    it('keeps nuts plural', () => {
      expect(normalizeName('nuts')).toBe('nuts');
    });

    it('keeps almonds plural', () => {
      expect(normalizeName('almonds')).toBe('almonds');
    });

    it('keeps walnuts plural', () => {
      expect(normalizeName('walnuts')).toBe('walnuts');
    });

    it('keeps pecans plural', () => {
      expect(normalizeName('pecans')).toBe('pecans');
    });

    it('keeps cashews plural', () => {
      expect(normalizeName('cashews')).toBe('cashews');
    });

    it('keeps peanuts plural', () => {
      expect(normalizeName('peanuts')).toBe('peanuts');
    });

    it('keeps cloves plural', () => {
      expect(normalizeName('cloves')).toBe('cloves');
    });

    it('keeps spices plural', () => {
      expect(normalizeName('spices')).toBe('spices');
    });

    it('keeps herbs plural', () => {
      expect(normalizeName('herbs')).toBe('herbs');
    });

    it('keeps greens plural', () => {
      expect(normalizeName('greens')).toBe('greens');
    });

    it('keeps sprouts plural', () => {
      expect(normalizeName('sprouts')).toBe('sprouts');
    });

    it('keeps leftovers plural', () => {
      expect(normalizeName('leftovers')).toBe('leftovers');
    });

    it('keeps chives plural', () => {
      expect(normalizeName('chives')).toBe('chives');
    });

    it('keeps molasses plural', () => {
      expect(normalizeName('molasses')).toBe('molasses');
    });
  });

  describe('Special cases', () => {
    it('removes size/unit patterns from ingredient names', () => {
      expect(normalizeName('14.5 oz can diced tomatoes')).toBe('can tomato');
    });

    it('removes duplicated words from parentheses', () => {
      expect(normalizeName('scallions (scallions)')).toBe('scallion');
    });

    it('removes tilde approximations', () => {
      expect(normalizeName('~2 onions')).toBe('onions');
    });

    it('removes about fraction approximations', () => {
      expect(normalizeName('about 1/2 lemon')).toBe('lemon');
    });

    it('handles complex herb patterns with scallions', () => {
      expect(normalizeName('fresh chopped herbs scallions')).toBe('scallion');
    });

    it('handles complex herb patterns with cilantro', () => {
      expect(normalizeName('fresh chopped herbs cilantro')).toBe('fresh herbs cilantro');
    });

    it('handles complex herb patterns with parsley', () => {
      expect(normalizeName('fresh chopped herbs parsley')).toBe('fresh herbs parsley');
    });
  });

  describe('Irrelevant adjectives dropped', () => {
    it('removes ripe from ripe bananas', () => {
      expect(normalizeName('ripe bananas')).toBe('banana');
    });

    it('removes mini from mini cucumbers', () => {
      expect(normalizeName('mini cucumbers')).toBe('mini cucumber');
    });

    it('removes jumbo from jumbo shrimp', () => {
      expect(normalizeName('jumbo shrimp')).toBe('shrimp');
    });

    it('removes large from large eggs', () => {
      expect(normalizeName('large eggs')).toBe('large eggs');
    });

    it('removes medium from medium potatoes', () => {
      expect(normalizeName('medium potatoes')).toBe('potato');
    });

    it('removes small from small apples', () => {
      expect(normalizeName('small apples')).toBe('apple');
    });

    it('removes extra from extra virgin olive oil', () => {
      expect(normalizeName('extra virgin olive oil')).toBe('olive oil');
    });

    it('removes super from super sweet corn', () => {
      expect(normalizeName('super sweet corn')).toBe('sweet corn');
    });
  });

  describe('Mixed examples', () => {
    it('normalizes freshly ground black pepper', () => {
      expect(normalizeName('freshly ground black pepper')).toBe('black pepper');
    });

    it('preserves whole wheat flour', () => {
      expect(normalizeName('whole wheat flour')).toBe('whole wheat flour');
    });

    it('preserves sun dried tomatoes', () => {
      expect(normalizeName('sun dried tomatoes')).toBe('sun dried tomato');
    });

    it('preserves smoked paprika', () => {
      expect(normalizeName('smoked paprika')).toBe('smoked paprika');
    });

    it('preserves ground beef', () => {
      expect(normalizeName('ground beef')).toBe('ground beef');
    });

    it('preserves shredded cheese', () => {
      expect(normalizeName('shredded cheese')).toBe('cheese');
    });

    it('preserves roasted red peppers', () => {
      expect(normalizeName('roasted red peppers')).toBe('roasted red pepper');
    });

    it('preserves aged cheddar', () => {
      expect(normalizeName('aged cheddar')).toBe('aged cheddar');
    });

    it('preserves active dry yeast', () => {
      expect(normalizeName('active dry yeast')).toBe('active dry yeast');
    });

    it('preserves brown sugar', () => {
      expect(normalizeName('brown sugar')).toBe('brown sugar');
    });

    it('preserves heavy cream', () => {
      expect(normalizeName('heavy cream')).toBe('heavy cream');
    });

    it('preserves cottage cheese', () => {
      expect(normalizeName('cottage cheese')).toBe('cottage cheese');
    });

    it('preserves bell pepper', () => {
      expect(normalizeName('bell pepper')).toBe('bell pepper');
    });

    it('preserves red wine vinegar', () => {
      expect(normalizeName('red wine vinegar')).toBe('red wine vinegar');
    });

    it('preserves soy sauce', () => {
      expect(normalizeName('soy sauce')).toBe('soy sauce');
    });

    it('preserves chicken broth', () => {
      expect(normalizeName('chicken broth')).toBe('chicken broth');
    });

    it('preserves greek yogurt', () => {
      expect(normalizeName('greek yogurt')).toBe('greek yogurt');
    });

    it('preserves golden potatoes', () => {
      expect(normalizeName('golden potatoes')).toBe('golden potato');
    });

    it('preserves red potatoes', () => {
      expect(normalizeName('red potatoes')).toBe('red potato');
    });

    it('preserves sweet potatoes', () => {
      expect(normalizeName('sweet potatoes')).toBe('sweet potato');
    });

    it('preserves russet potatoes', () => {
      expect(normalizeName('russet potatoes')).toBe('russet potato');
    });

    it('preserves yukon gold potatoes', () => {
      expect(normalizeName('yukon gold potatoes')).toBe('yukon gold potato');
    });

    it('preserves purple potatoes', () => {
      expect(normalizeName('purple potatoes')).toBe('purple potato');
    });

    it('preserves white potatoes', () => {
      expect(normalizeName('white potatoes')).toBe('white potato');
    });

    it('preserves small potatoes', () => {
      expect(normalizeName('small potatoes')).toBe('potato');
    });

    it('preserves baby potatoes', () => {
      expect(normalizeName('baby potatoes')).toBe('potato');
    });

    it('preserves fingerling potatoes', () => {
      expect(normalizeName('fingerling potatoes')).toBe('fingerling potato');
    });

    it('preserves mini cucumbers', () => {
      expect(normalizeName('mini cucumbers')).toBe('mini cucumber');
    });

    it('preserves fresh or frozen', () => {
      expect(normalizeName('fresh or frozen')).toBe('fresh or frozen');
    });

    it('preserves frozen or fresh', () => {
      expect(normalizeName('frozen or fresh')).toBe('frozen or fresh');
    });

    it('preserves fresh or dried', () => {
      expect(normalizeName('fresh or dried')).toBe('fresh or dried');
    });

    it('preserves dried or fresh', () => {
      expect(normalizeName('dried or fresh')).toBe('dried or fresh');
    });

    it('preserves fresh or canned', () => {
      expect(normalizeName('fresh or canned')).toBe('fresh or canned');
    });

    it('preserves canned or fresh', () => {
      expect(normalizeName('canned or fresh')).toBe('canned or fresh');
    });
  });

  describe('Edge cases and error handling', () => {
    it('handles empty string', () => {
      expect(normalizeName('')).toBe('');
    });

    it('handles single space', () => {
      expect(normalizeName(' ')).toBe(' ');
    });

    it('handles multiple spaces', () => {
      expect(normalizeName('   ')).toBe('   ');
    });

    it('handles only punctuation', () => {
      expect(normalizeName('!!!')).toBe('!!!');
    });

    it('handles numbers only', () => {
      expect(normalizeName('123')).toBe('123');
    });

    it('handles mixed case', () => {
      expect(normalizeName('ReD OnIoN')).toBe('red onion');
    });

    it('handles very long ingredient names', () => {
      const longName = 'extra large organic free-range grass-fed chicken breast with skin and bones';
      expect(normalizeName(longName)).toBe('free range grass fed chicken breast with skin and bone');
    });

    it('handles special characters', () => {
      expect(normalizeName('onion & garlic')).toBe('onion & garlic');
    });

    it('handles hyphens', () => {
      expect(normalizeName('all-purpose flour')).toBe('all purpose flour');
    });

    it('handles apostrophes', () => {
      expect(normalizeName("children's medicine")).toBe('children\'s medicine');
    });
  });

});
