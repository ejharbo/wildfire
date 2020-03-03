<!-- mt2skos.xsl: Convert XML exported from MultiTes to SKOS.
     use of encode-for-uri() function and XSLT 2.0 xsl:for-each-group assumes use of Saxon

2011-03-14 Bob DuCharme
2011-07-13 Bob added SN -> skos:prefLabel template 

- baseURI below needs to be reset or passed as a parameter to Saxon to override the default value

sample command line: 
java -jar \some\path\saxon8.jar -o EmTreeXL.rdf Emtree_2011.xml mt2skos.xsl baseURI=http://topbraid.org/emtree/ SKOSXLOutput=true

Note on command line use: 
- Xmx1024m may be necessary after "java" for larger files
- SKOSXLOutput default value is false
- baseURI default value is http://stub/base/URI#

Concept scheme created as $baseURI+"ConceptScheme", but still needs skos:hasTopConcept properties. Create in SPARQL with this: 

     CONSTRUCT {
       <http://topbraid.org/demo/orgtree/OrgtreeConceptScheme> skos:hasTopConcept ?c
     }
     WHERE {
      ?c a skos:Concept 
       NOT EXISTS {
       ?c skos:broader ?b
       }
     }
-->
<xsl:stylesheet version="2.0"
                xmlns:skos="http://www.w3.org/2004/02/skos/core#"
                xmlns:xl="http://www.w3.org/2008/05/skos-xl#"
                xmlns:ui="http://uispin.org/ui#"
                xmlns:dc="http://purl.org/dc/elements/1.1/"
                xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
                xmlns:owl="http://www.w3.org/2002/07/owl#"
                xmlns:mt="http://www.topquadrant.com/2009/12/multites#"
                xmlns:dct="http://purl.org/dc/terms/"
                xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
                xmlns:foaf="http://xmlns.com/foaf/0.1/"
                xmlns:xs="http://www.w3.org/2001/XMLSchema#"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

<!--  <xsl:strip-space elements="*"/> -->
  <xsl:output indent="yes"/>

  <xsl:param name="baseURI">http://stub/base/URI#</xsl:param>

  <xsl:param name="SKOSXLOutput">false</xsl:param>
  <!-- Boolean parameter can't be passed from command line, so
       $OutputXL is set as boolean depending on value of SKOXSLOutput
       string value that was passed. -->

  <xsl:variable name="OutputXL" select="$SKOSXLOutput = 'true'"/>

  <xsl:template match="THESAURUS">
    <rdf:RDF
        xmlns:skos="http://www.w3.org/2004/02/skos/core#"
        xmlns:ui="http://uispin.org/ui#"
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
        xml:base="{$baseURI}"
        xmlns:mt="http://www.topquadrant.com/2009/12/multites#">

      <!-- trim final / from baseURI if necessary for finding local name-->
      <xsl:variable name="trimmedURI" select="
                                              if(ends-with($baseURI,'/')) 
                                              then substring($baseURI,1,string-length($baseURI) - 1)
                                              else $baseURI">
      </xsl:variable>

      <xsl:variable name="baseURILocalName"> 
        <!-- Get local name of base URI for concept scheme name -->
        <xsl:analyze-string select="$trimmedURI" regex=".*[#/](.+)/?">
          <xsl:matching-substring>
            <xsl:value-of select="regex-group(1)"/>
          </xsl:matching-substring>
          <xsl:non-matching-substring>SchemeName</xsl:non-matching-substring>
        </xsl:analyze-string>
      </xsl:variable>

      <rdf:Description rdf:about="">
        <owl:imports rdf:resource="http://www.w3.org/2004/02/skos/core"/>
      </rdf:Description>

      <skos:ConceptScheme rdf:about="{$baseURI}ConceptScheme">
        <rdfs:label><xsl:value-of select="$baseURILocalName"/> Concept Scheme</rdfs:label>
      </skos:ConceptScheme>

      <!-- If any CONCEPT element has a child that's not in this list,
           declare a lower-case version of its name as a datatype property.  -->
      <xsl:for-each-group select="CONCEPT/*" group-by="name()">
        <xsl:if test="not(contains('|DESCRIPTOR|NON-DESCRIPTOR|USE|SC|PPP|RT|UF|NT|BT|STA|INP|APP|NVD|UPD|TNR|FLG|',concat('|',name(),'|')))">
          <xsl:variable name="lcname" select="translate(name(),
                                              'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                                              'abcdefghijklmnopqrstuvwxyz')"/>
          <rdf:Description rdf:about="http://www.topquadrant.com/2009/12/multites#{$lcname}">
            <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#DatatypeProperty"/>
            <rdfs:domain rdf:resource="http://www.w3.org/2004/02/skos/core#Concept"/>
          </rdf:Description>
        </xsl:if>

      </xsl:for-each-group>

      <!-- process concepts -->
      <xsl:apply-templates/>

      <xsl:if test="$OutputXL">
        <rdf:Description rdf:about="">
          <owl:imports rdf:resource="http://www.w3.org/2008/05/skos-xl"/>
          <owl:imports rdf:resource="http://evn-xl.topbraidlive.org/label-metadata"/>
        </rdf:Description>
        <xsl:apply-templates select="//DESCRIPTOR" mode="MakeXLLabel"/>
        <xsl:apply-templates select="//NON-DESCRIPTOR" mode="MakeXLLabel"/>
      </xsl:if>

    </rdf:RDF>

  </xsl:template>


  <xsl:template match="DESCRIPTOR|NON-DESCRIPTOR" mode="MakeXLLabel">
    <xl:Label rdf:about="{$baseURI}L-{encode-for-uri(.)}" xl:literalForm="{.}"/>
  </xsl:template>


  <xsl:template match="CONCEPT[DESCRIPTOR]">
    <!-- @rdf:about value massaged by some function in SPARQL version -->

    <skos:Concept rdf:about="{$baseURI}C-{encode-for-uri(DESCRIPTOR)}">
      <xsl:apply-templates/>
    </skos:Concept>

    <xsl:if test="not(BT)">
      <!-- If no broader term value... -->
      <skos:ConceptScheme rdf:about="{$baseURI}ConceptScheme">
        <skos:hasTopConcept rdf:resource="{$baseURI}C-{encode-for-uri(DESCRIPTOR)}"/>
      </skos:ConceptScheme>
    </xsl:if>

  </xsl:template>


  <xsl:template match="CONCEPT[NON-DESCRIPTOR]">
    <!-- @rdf:about value massaged by some function in SPARQL version -->
    <skos:Concept rdf:about="{$baseURI}C-{encode-for-uri(USE[1])}">
      <xsl:apply-templates/>
    </skos:Concept>
  </xsl:template>

  <!-- Covered by previous template -->
    <xsl:template match="CONCEPT[NON-DESCRIPTOR]/USE[1]"/>


  <!-- The following is somewhat redundant with the previous one, but covers the case where a NON-DESCRIPTOR has more than one USE value, which I found in the U Mich subject.xml file -->
  <!--
      <xsl:template match="CONCEPT[NON-DESCRIPTOR]/USE">
      <skos:Concept rdf:about="{$baseURI}{.}">
      <xsl:call-template name="altLabel">
      <xsl:with-param name="labelString" select="../NON-DESCRIPTOR"/>
      </xsl:call-template>
      </skos:Concept>
      </xsl:template>
  -->
  <xsl:template match="CONCEPT/DESCRIPTOR">
    <xsl:choose>
      <xsl:when test="$OutputXL">
        <xl:prefLabel rdf:resource="{$baseURI}L-{encode-for-uri(.)}"/>
        <rdfs:label><xsl:apply-templates/></rdfs:label> 
      </xsl:when>
      <xsl:otherwise>
        <skos:prefLabel><xsl:apply-templates/></skos:prefLabel>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="CONCEPT/NON-DESCRIPTOR">
    <xsl:call-template name="altLabel">
      <xsl:with-param name="labelString" select="."/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="altLabel">
    <xsl:param name="labelString" select="."/>
    <xsl:choose>
      <xsl:when test="$OutputXL">
        <xl:altLabel rdf:resource="{$baseURI}L-{encode-for-uri(.)}"/>
      </xsl:when>
      <xsl:otherwise>
        <skos:altLabel><xsl:value-of select="."/></skos:altLabel>
      </xsl:otherwise>
    </xsl:choose>

  </xsl:template>

  <xsl:template match="CONCEPT/SC">
    <dc:source><xsl:apply-templates/></dc:source>
  </xsl:template>

  <xsl:template match="CONCEPT/RT">
    <!-- Massaged in SPARQL version. -->
    <skos:related rdf:resource="{$baseURI}C-{encode-for-uri(.)}"/>
  </xsl:template>

  <xsl:template match="CONCEPT/UF">
    <xsl:call-template name="altLabel">
      <xsl:with-param name="labelString" select="."/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="CONCEPT/NT">
    <!-- Massaged -->
    <skos:narrower rdf:resource="{$baseURI}C-{encode-for-uri(.)}"/>
  </xsl:template>

  <xsl:template match="CONCEPT/BT">
    <!-- Massaged -->
    <skos:broader rdf:resource="{$baseURI}C-{encode-for-uri(.)}"/>
  </xsl:template>

  <xsl:template match="CONCEPT/SN">
    <!-- Massaged -->
    <skos:scopeNote><xsl:apply-templates/></skos:scopeNote>
  </xsl:template>

  <xsl:template match="CONCEPT/STA">
    <mt:sta><xsl:apply-templates/></mt:sta>
  </xsl:template>

  <xsl:template match="CONCEPT/INP">
    <dct:dateSubmitted rdf:datatype="http://www.w3.org/2001/XMLSchema#date">
      <xsl:apply-templates/>
    </dct:dateSubmitted>
  </xsl:template>

  <xsl:template match="CONCEPT/APP">
    <dct:dateAccepted rdf:datatype="http://www.w3.org/2001/XMLSchema#date">
      <xsl:apply-templates/>
    </dct:dateAccepted>
  </xsl:template>

  <xsl:template match="CONCEPT/NVD">
    <mt:nvd rdf:datatype="http://www.w3.org/2001/XMLSchema#date">
      <xsl:apply-templates/>
    </mt:nvd>
  </xsl:template>

  <xsl:template match="CONCEPT/UPD">
    <dct:modified rdf:datatype="http://www.w3.org/2001/XMLSchema#date">
      <xsl:apply-templates/>
    </dct:modified>
  </xsl:template>

  <xsl:template match="CONCEPT/TNR">
    <mt:tnr><xsl:apply-templates/></mt:tnr>
  </xsl:template>

  <xsl:template match="CONCEPT/FLG">
    <mt:flg><xsl:apply-templates/></mt:flg>
  </xsl:template>


  <xsl:template match="CONCEPT/*" priority=".1">

    <!-- Any custom fields added to MultiTes: put in MT namespace with
         lower-case version of custom name as property name. -->

    <xsl:variable name="localName" select="translate(local-name(),
                                           'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                                           'abcdefghijklmnopqrstuvwxyz')"/>

    <xsl:element name="mt:{$localName}">
      <xsl:apply-templates/>
    </xsl:element>

  </xsl:template>


  <xsl:template match="@*|*">
    <xsl:copy>
      <xsl:apply-templates select="@*|*"/>
    </xsl:copy>
  </xsl:template>


</xsl:stylesheet>
