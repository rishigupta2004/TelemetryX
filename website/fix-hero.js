const fs = require('fs');
let content = fs.readFileSync('src/components/sections/Hero.tsx', 'utf8');

// Clean up trailing divs
content = content.replace(
  /<\/motion\.div>\n\s*<\/motion\.div>\n\s*<\/div>\n\s*<\/section>/g,
  '</motion.div>\n    </section>'
);

// Manually rewrite bottom half of Hero correctly:
content = content.split('</motion.div>')[0] + `</motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="w-full relative z-20 mt-12 px-6"
      >
         <AppMockup />
      </motion.div>
    </section>
  );
}
`;

fs.writeFileSync('src/components/sections/Hero.tsx', content);
